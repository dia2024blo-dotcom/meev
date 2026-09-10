import { db } from '@/lib/db'
import { clearRefreshCookie, consumeRefreshToken, createSession, readRefreshCookie, revokeRefreshToken, setRefreshCookie, signAccessToken } from '@/lib/meev/auth'
import { serverError } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { selfUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // v13 security pass: bound the refresh endpoint itself — unauthenticated
    // clients could otherwise hammer it (DB lookups per call + cookie churn).
    const rl = rateLimit(`refresh:${clientIp(req)}`, 30, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const raw = readRefreshCookie(req)
    if (!raw) return Response.json({ error: 'No refresh token' }, { status: 401 })

    const user = await consumeRefreshToken(raw)
    if (!user) {
      const res = Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
      clearRefreshCookie(res)
      return res
    }

    // v13 security pass: re-check owner-level sanctions on every rotation.
    // Bans revoke tokens at sanction time, but defense-in-depth here stops a
    // banned/suspended account from silently rotating back in with a token
    // issued seconds before the ban.
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      const res = Response.json({ error: '🚫 Account banned / الحساب محظور' }, { status: 403 })
      clearRefreshCookie(res)
      return res
    }
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      const res = Response.json({ error: 'Account temporarily suspended / الحساب موقوف مؤقتاً' }, { status: 403 })
      clearRefreshCookie(res)
      return res
    }

    // rotate: revoke old, issue new session + refresh token + access token
    await revokeRefreshToken(raw)
    const fresh = await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
    const newRaw = await createSession(fresh.id, req)
    const { token, expiresIn } = signAccessToken(fresh.id, fresh.username)

    const res = Response.json({
      user: await selfUser(fresh),
      accessToken: token,
      expiresIn,
    })
    setRefreshCookie(res, newRaw)
    return res
  } catch (err) {
    return serverError(err)
  }
}
