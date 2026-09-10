// MEEV realtime service — inline HS256 JWT verification.
// Approach copied from /home/z/my-project/src/lib/meev/auth.ts (b64url decode +
// timingSafeEqual comparison). No imports from the Next.js project.

import crypto from 'node:crypto'
import { JWT_SECRET } from './config'

// ------------------------- b64url helpers -------------------------

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlJson(obj: object): string {
  return b64url(Buffer.from(JSON.stringify(obj)))
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// ------------------------- JWT (HS256) -------------------------

export interface JwtPayload {
  sub: string
  username: string
  iat: number
  exp: number
  typ: string
}

/** Sign an access token (used by the smoke-test client; mirrors auth.ts). */
export function signAccessToken(userId: string, username: string, ttlSeconds = 900): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({ sub: userId, username, iat: now, exp: now + ttlSeconds, typ: 'access' })
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${sig}`
}

/** Verify an access token. Returns null on any malformed/forged/expired token. */
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
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    if (typeof payload.username !== 'string' || !payload.username) return null
    return payload
  } catch {
    return null
  }
}
