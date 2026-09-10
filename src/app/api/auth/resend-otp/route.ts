import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { newOtp } from '@/lib/meev/auth'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { sanitizeEmail } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PURPOSES = new Set(['verify', 'reset', 'twofactor'])

export async function POST(req: Request) {
  try {
    const body = await readJson(req)
    const email = sanitizeEmail(body.email)
    const purpose = typeof body.purpose === 'string' && PURPOSES.has(body.purpose) ? body.purpose : 'verify'
    if (!email) return badRequest('Email is required')

    const rl = rateLimit(`resend:${clientIp(req)}:${email}`, 3, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const user = await db.user.findUnique({ where: { email } })
    // v13 security pass — anti-enumeration: respond identically whether or
    // not the account exists (the old 404 revealed registered emails).
    if (user) {
      // invalidate previous unused tokens of this purpose
      await db.emailToken.updateMany({
        where: { userId: user.id, purpose, usedAt: null },
        data: { usedAt: new Date() },
      })

      const code = newOtp()
      const expiresAt = new Date(Date.now() + 15 * 60_000)
      await db.emailToken.create({
        data: { id: newId(), userId: user.id, code, purpose, expiresAt },
      })

      // v13 security pass: the OTP itself only ever leaves the server when
      // SMTP is in demo mode (same gate as /api/auth/forgot-password). A
      // production deploy MUST NOT hand the code to whoever asks for it.
      if (process.env.MEEV_SMTP_MODE === 'demo') {
        return Response.json({ devOtp: { code, purpose, expiresAt: expiresAt.toISOString() } })
      }
    }
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
