// MEEV — Route guard: requireUser + per-user sliding-window rate limit,
// plus standard error-response helpers used by every API route.

import type { User } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser, unauthorized } from './auth'
import { rateLimit, rateLimitResponse } from './rate-limit'

const GENERAL_LIMIT = Number(process.env.MEEV_RATE_LIMIT_MAX || 120)

export type GuardOk = { user: User; response?: undefined }
export type GuardFail = { user?: undefined; response: Response }
export type GuardResult = GuardOk | GuardFail

/** Bearer auth + general 120/min-per-user limit (contract convention). */
export async function guard(req: Request, limit = GENERAL_LIMIT, windowMs = 60_000): Promise<GuardResult> {
  const user = await requireUser(req)
  if (!user) return { response: unauthorized() }
  // v5 owner-level ban: hard-block every API while active
  if (user.bannedUntil && user.bannedUntil > new Date()) {
    const isPermanent = user.bannedUntil.getTime() - Date.now() > 99 * 365 * 86400_000
    return {
      response: Response.json(
        {
          error: isPermanent
            ? '🚫 حسابك محظور نهائياً من Meev / Your account is permanently banned'
            : `🚫 حسابك محظور حتى ${user.bannedUntil.toISOString().replace('T', ' ').slice(0, 16)} UTC / banned until then`,
        },
        { status: 403 },
      ),
    }
  }
  const rl = rateLimit(`api:${user.id}`, limit, windowMs)
  if (!rl.ok) return { response: rateLimitResponse(rl.retryAfter) }
  // v6 real presence: any authenticated API call proves the user is live.
  // Throttled to one write per ~45s so hot paths stay cheap.
  if (Date.now() - user.lastActiveAt.getTime() > 45_000) {
    void db.user
      .update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
      .catch(() => null)
  }
  return { user }
}

export function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

export function notFound(msg = 'Not found') {
  return Response.json({ error: msg }, { status: 404 })
}

export function forbidden(msg = 'Forbidden') {
  return Response.json({ error: msg }, { status: 403 })
}

export function serverError(err?: unknown) {
  if (err instanceof Error) {
    console.error('[meev:api]', err.message)
  } else if (err) {
    console.error('[meev:api]', String(err))
  }
  return Response.json({ error: 'Something went wrong on our side 🐱' }, { status: 500 })
}

/** Safe JSON body reader — never throws, returns {} for invalid payloads. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

export function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

export function pageParam(url: URL): number {
  const p = Number(url.searchParams.get('page') || '1')
  return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1
}
