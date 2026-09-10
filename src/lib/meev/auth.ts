// MEEV — Auth core: scrypt password hashing (per-user salt, memory-hard),
// HMAC-SHA256 JWT access tokens, opaque refresh tokens (hashed at rest),
// session management, brute-force lockout, route guards.
// Spec §4 — sandbox-safe implementation using node:crypto primitives.

import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { newId } from './ids'
import { MEEV_COOKIE } from './constants'

const JWT_SECRET = process.env.MEEV_JWT_SECRET || 'meev-dev-secret'
const ACCESS_TTL = 60 * 15 // 15 minutes
const REFRESH_TTL_DAYS = 30

// v13 security pass: secrets must NEVER silently fall back to the public
// dev defaults when the app runs in production — a missing MEEV_JWT_SECRET
// there would let anyone forge access tokens with the known default string.
// (In development the .env already sets both, so this only fires on misdeploy.)
if (process.env.NODE_ENV === 'production') {
  if (!process.env.MEEV_JWT_SECRET) {
    throw new Error('[meev:security] MEEV_JWT_SECRET is required in production — refusing to start with the dev default')
  }
  if (!process.env.MEEV_SERVICE_KEY) {
    throw new Error('[meev:security] MEEV_SERVICE_KEY is required in production — internal APIs must not be fail-open')
  }
}

// ------------------------- passwords -------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const N = 16384, r = 8, p = 1
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, Ns, rs, ps, saltB64, hashB64] = stored.split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: parseInt(Ns), r: parseInt(rs), p: parseInt(ps),
    })
    return crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export type PasswordIssue = string | null
export function checkPasswordStrength(pw: string): PasswordIssue {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-z]/.test(pw)) return 'Password needs a lowercase letter'
  if (!/[A-Z]/.test(pw)) return 'Password needs an uppercase letter'
  if (!/[0-9]/.test(pw)) return 'Password needs a number'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password needs a symbol'
  return null
}

// ------------------------- JWT (HS256) -------------------------

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlJson(obj: object): string {
  return b64url(Buffer.from(JSON.stringify(obj)))
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export interface JwtPayload {
  sub: string
  username: string
  iat: number
  exp: number
  typ: 'access'
}

export function signAccessToken(userId: string, username: string): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({ sub: userId, username, iat: now, exp: now + ACCESS_TTL, typ: 'access' })
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest())
  return { token: `${header}.${payload}.${sig}`, expiresIn: ACCESS_TTL }
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest()
    const got = fromB64url(s)
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null
    const payload = JSON.parse(fromB64url(p).toString()) as JwtPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    if (payload.typ !== 'access') return null
    return payload
  } catch {
    return null
  }
}

// ------------------------- refresh tokens & sessions -------------------------

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export function newOtp(): string {
  return String(crypto.randomInt(100000, 999999))
}

export function deviceFromUa(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS device'
  if (/android/i.test(ua)) return 'Android device'
  if (/macintosh|mac os/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows PC'
  if (/linux/i.test(ua)) return 'Linux PC'
  return 'Unknown device'
}

/** Creates session + refresh token, returns the raw refresh token to set as cookie. */
export async function createSession(userId: string, req: Request): Promise<string> {
  const ua = req.headers.get('user-agent') || ''
  const device = deviceFromUa(ua)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000)
  await db.session.create({
    data: { id: newId(), userId, device, ip, userAgent: ua.slice(0, 250), expiresAt },
  })
  const raw = crypto.randomBytes(48).toString('hex')
  await db.refreshToken.create({
    data: { id: newId(), userId, tokenHash: sha256(raw), sessionDevice: device, expiresAt },
  })
  // v13 security pass (session hygiene, fire-and-forget): every refresh mints
  // a NEW session + refresh row — without pruning, a 30-day login that
  // refreshes every 15min accumulates ~2.9k live session rows per user
  // (unbounded growth + a wide session-fixation/stale-session surface).
  // Prune: expired rows go; live sessions are capped to the newest 20.
  void (async () => {
    try {
      const now = new Date()
      await db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] } })
      await db.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 7 * 86400_000) } }] } })
      const live = await db.session.findMany({
        where: { userId, expiresAt: { gt: now }, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true },
      })
      if (live.length === 20) {
        await db.session.deleteMany({
          where: { userId, id: { notIn: live.map((s) => s.id) }, expiresAt: { gt: now } },
        })
      }
    } catch {
      // pruning is bookkeeping — never fail the login/refresh
    }
  })()
  return raw
}

export async function consumeRefreshToken(raw: string) {
  const token = await db.refreshToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  })
  if (!token || token.revokedAt || token.expiresAt < new Date()) return null
  return token.user
}

export async function revokeRefreshToken(raw: string) {
  await db.refreshToken.updateMany({
    where: { tokenHash: sha256(raw) },
    data: { revokedAt: new Date() },
  })
}

/** Refresh token cookie (HttpOnly, Secure, SameSite=Lax, path-scoped).
 * v13: __Host- prefix is not usable here (sandbox serves over plain HTTP
 * through the gateway), but Secure is forced in production as before. */
export function setRefreshCookie(res: Response, raw: string) {
  res.headers.append(
    'set-cookie',
    `${MEEV_COOKIE}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${REFRESH_TTL_DAYS * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  )
}

export function clearRefreshCookie(res: Response) {
  res.headers.append('set-cookie', `${MEEV_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export function readRefreshCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === MEEV_COOKIE) return v.join('=')
  }
  return null
}

// ------------------------- route guards -------------------------

export async function requireUser(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const payload = verifyAccessToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({ where: { id: payload.sub } })
  if (!user) return null
  return user
}

export function requireServiceKey(req: Request): boolean {
  // v13 security pass — FAIL CLOSED: when MEEV_SERVICE_KEY is unset, an
  // attacker sending an EMPTY `x-meev-service-key:` header used to pass the
  // `'' === ''` comparison and reach every /api/internal/** route (XP grants,
  // presence writes, notifications, AI replies). With no configured key the
  // answer is always "no".
  const expected = process.env.MEEV_SERVICE_KEY
  if (!expected) return false
  const got = req.headers.get('x-meev-service-key')
  return !!got && got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data as object, init)
}
