import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { newOtp } from '@/lib/meev/auth'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { sanitizeEmail } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await readJson(req)
    const email = sanitizeEmail(body.email)
    if (!email) return badRequest('Email is required')

    const rl = rateLimit(`forgot:${clientIp(req)}:${email}`, 3, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    // never reveal whether the account exists
    const user = await db.user.findUnique({ where: { email } })
    if (user) {
      await db.emailToken.updateMany({
        where: { userId: user.id, purpose: 'reset', usedAt: null },
        data: { usedAt: new Date() },
      })
      const code = newOtp()
      const expiresAt = new Date(Date.now() + 15 * 60_000)
      await db.emailToken.create({
        data: { id: newId(), userId: user.id, code, purpose: 'reset', expiresAt },
      })
      if (process.env.MEEV_SMTP_MODE === 'demo') {
        return Response.json({ ok: true, devOtp: { code, purpose: 'reset', expiresAt: expiresAt.toISOString() } })
      }
    }
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
