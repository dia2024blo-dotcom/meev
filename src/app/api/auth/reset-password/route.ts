import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { checkPasswordStrength, hashPassword } from '@/lib/meev/auth'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeEmail } from '@/lib/meev/sanitize'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await readJson(req)
    const email = sanitizeEmail(body.email)
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!email || !code) return badRequest('Email and code are required')

    // v13 security pass: reset codes are 6 digits / 15min — a parallel
    // brute-force here would take over the account, so bound attempts
    // tightly (10/min per IP, 40 per 15min per targeted email).
    const rl1 = rateLimit(`resetpw:${clientIp(req)}`, 10, 60_000)
    if (!rl1.ok) return rateLimitResponse(rl1.retryAfter)
    const rl2 = rateLimit(`resetpw-code:${email}`, 40, 900_000)
    if (!rl2.ok) return rateLimitResponse(rl2.retryAfter)

    const pwIssue = checkPasswordStrength(newPassword)
    if (pwIssue) return badRequest(pwIssue)

    const user = await db.user.findUnique({ where: { email } })
    if (!user) return badRequest('Invalid or expired reset code')

    const token = await db.emailToken.findFirst({
      where: { userId: user.id, purpose: 'reset', code, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!token) return badRequest('Invalid or expired reset code')

    await db.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } })

    // revoke all sessions + refresh tokens
    const now = new Date()
    await db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } })
    await db.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } })

    await db.auditLog.create({
      data: { id: newId(), userId: user.id, action: 'password_reset', meta: '{}' },
    })

    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
