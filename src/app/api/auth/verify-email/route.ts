import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeEmail } from '@/lib/meev/sanitize'
import { selfUser } from '@/lib/meev/dto'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // v13 security pass: the 6-digit code has ~900k possibilities and a 15min
    // window — without a limiter an attacker could brute-force it in parallel.
    // 10/min per IP + 40/15min per email ≈ 600 tries across the window, and
    // a wrong guess still costs a DB lookup each time.
    const body = await readJson(req)
    const email = sanitizeEmail(body.email)
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!email || !code) return badRequest('Email and code are required')

    const rl1 = rateLimit(`verify:${clientIp(req)}`, 10, 60_000)
    if (!rl1.ok) return rateLimitResponse(rl1.retryAfter)
    const rl2 = rateLimit(`verify-code:${email}`, 40, 900_000)
    if (!rl2.ok) return rateLimitResponse(rl2.retryAfter)

    const user = await db.user.findUnique({ where: { email } })
    if (!user) return badRequest('Invalid email or code')

    const token = await db.emailToken.findFirst({
      where: {
        userId: user.id,
        purpose: 'verify',
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!token) return badRequest('Invalid or expired code')

    await db.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
    const fresh = await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    })

    // +15 XP for verifying + founder badge safety net
    // v16: no verification XP — levels come only from interaction hours
    const hasFounder = await db.userBadge.findFirst({ where: { userId: user.id, badgeKey: 'founder' } })
    if (!hasFounder) {
      await db.userBadge.create({ data: { id: newId(), userId: user.id, badgeKey: 'founder' } })
    }

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    return Response.json({ user: await selfUser(updated) })
  } catch (err) {
    return serverError(err)
  }
}
