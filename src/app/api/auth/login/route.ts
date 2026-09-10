import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { deviceFromUa, newOtp, setRefreshCookie, verifyPassword } from '@/lib/meev/auth'
import { issueAuth } from '@/lib/meev/auth-flow'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { sanitizeEmail } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await readJson(req)
    const identifierRaw = typeof body.identifier === 'string' ? body.identifier.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const otp = typeof body.otp === 'string' ? body.otp.trim() : ''
    if (!identifierRaw || !password) return badRequest('Identifier and password are required')

    const identifier = identifierRaw.includes('@') ? sanitizeEmail(identifierRaw) : identifierRaw.toLowerCase()
    // v6 anti-brute-force: per-IP 10/min …
    const rl = rateLimit(`login:${clientIp(req)}`, 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)
    // … plus a 30-attempts / 10-min ceiling on the same IP (stops
    // credential-stuffing sweeps that rotate identifiers slowly)
    const rl2 = rateLimit(`loginip:${clientIp(req)}`, 30, 600_000)
    if (!rl2.ok) return rateLimitResponse(rl2.retryAfter)

    const user = await db.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    })
    if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 })

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000))
      // audit lockouts — repeated lockouts are a theft attempt signal
      await db.auditLog
        .create({
          data: {
            id: newId(),
            userId: user.id,
            action: 'login_lockout_hit',
            ip: clientIp(req),
            meta: JSON.stringify({ minutesLeft: minutes }),
          },
        })
        .catch(() => null)
      return Response.json(
        {
          error: `قُفل الحساب مؤقتاً بعد محاولات فاشلة متكررة — حاول بعد ${minutes} دقيقة / Account temporarily locked after too many failed attempts. Try again in ${minutes} minutes`,
        },
        { status: 423 }
      )
    }

    // v4 community rules: a suspended account cannot sign in until the
    // sanction expires — the message tells the user exactly when it lifts
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.suspendedUntil.getTime() - Date.now()) / 60_000))
      return Response.json(
        {
          error: `حسابك موقوف مؤقتاً بموجب قوانين المجتمع — يمكنك العودة بعد ${minutes} دقيقة 🛡️ / Your account is temporarily suspended under the community rules — you can return in ${minutes} minutes 🛡️`,
        },
        { status: 403 }
      )
    }

    // v5 owner-level ban: hard gate on sign-in, with the reason if given
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      const isPermanent = user.bannedUntil.getTime() - Date.now() > 99 * 365 * 86400_000
      const until = user.bannedUntil.toISOString().replace('T', ' ').slice(0, 16)
      return Response.json(
        {
          error: isPermanent
            ? `🚫 حسابك محظور نهائياً من Meev.${user.bannedReason ? ` السبب: ${user.bannedReason}` : ''} / Your account is permanently banned.${user.bannedReason ? ` Reason: ${user.bannedReason}` : ''}`
            : `🚫 حسابك محظور حتى ${until} UTC.${user.bannedReason ? ` السبب: ${user.bannedReason}` : ''} / Your account is banned until ${until} UTC.`,
        },
        { status: 403 }
      )
    }

    if (!verifyPassword(password, user.passwordHash)) {
      const failed = user.failedLogins + 1
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      })
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // ---- two-factor gate ----
    if (user.twoFactorEnabled) {
      if (otp) {
        const otpToken = await db.emailToken.findFirst({
          where: {
            userId: user.id,
            purpose: 'twofactor',
            code: otp,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (!otpToken) return Response.json({ error: 'Invalid verification code' }, { status: 401 })
        await db.emailToken.update({ where: { id: otpToken.id }, data: { usedAt: new Date() } })
      } else {
        // issue a fresh 2FA code and tell the frontend to prompt for it
        const code = newOtp()
        const expiresAt = new Date(Date.now() + 10 * 60_000)
        await db.emailToken.create({
          data: { id: newId(), userId: user.id, code, purpose: 'twofactor', expiresAt },
        })
        return Response.json(
          // v13 security pass: the 2FA code itself is only returned when SMTP
          // is in demo mode (no mail transport in this sandbox) — in production
          // the code goes to the user's inbox, NEVER the login response.
          process.env.MEEV_SMTP_MODE === 'demo'
            ? { error: '2FA_REQUIRED', devOtp: { code, purpose: 'twofactor', expiresAt: expiresAt.toISOString() } }
            : { error: '2FA_REQUIRED' },
          { status: 401 }
        )
      }
    }

    // ---- success ----
    const device = deviceFromUa(req.headers.get('user-agent') || '')
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

    const priorDevice = await db.session.findFirst({ where: { userId: user.id, device } })
    if (!priorDevice) {
      await db.auditLog.create({
        data: { id: newId(), userId: user.id, action: 'login', ip, meta: JSON.stringify({ device }) },
      })
    }

    const now = new Date()
    const wasAway = user.lastActiveAt.getTime() < Date.now() - 20 * 3600_000
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        presence: 'online',
        lastActiveAt: now,
      },
    })
    // v16: no login XP — levels come only from interaction hours

    const payload = await issueAuth(updated, req)
    const res = Response.json({
      user: payload.user,
      accessToken: payload.accessToken,
      expiresIn: payload.expiresIn,
    })
    setRefreshCookie(res, payload.rawRefresh)
    return res
  } catch (err) {
    return serverError(err)
  }
}
