// MEEV — Sliding-window rate limiter (in-memory, per user or IP).
// Spec §9: 120 requests / minute per user/IP with 429 + retryAfter.

type Bucket = { hits: number[]; windowMs: number }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

const MAX = Number(process.env.MEEV_RATE_LIMIT_MAX || 120)
const WINDOW_MS = Number(process.env.MEEV_RATE_LIMIT_WINDOW || 60) * 1000

function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    // each bucket keeps its OWN window — a 5-min/1-hour limiter bucket must
    // not be swept with the global 60s window (that would erase still-counting
    // hits and silently turn e.g. 5/hour into 5/minute)
    bucket.hits = bucket.hits.filter((t) => now - t < bucket.windowMs)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

export type RateResult = { ok: true } | { ok: false; retryAfter: number }

export function rateLimit(key: string, max = MAX, windowMs = WINDOW_MS): RateResult {
  sweep()
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [], windowMs }
    buckets.set(key, bucket)
  } else if (windowMs > bucket.windowMs) {
    // a longer window must widen the bucket's retention too
    bucket.windowMs = windowMs
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0]
    return { ok: false, retryAfter: Math.ceil((oldest + windowMs - now) / 1000) }
  }
  bucket.hits.push(now)
  return { ok: true }
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    {
      error: 'تمهّل شوي — الطلبات كثيرة جداً! 🐱 / Easy there — too many requests, take a short breather! 🐱',
      retryAfter,
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } }
  )
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
  return (fwd || 'local').split(',')[0].trim()
}
