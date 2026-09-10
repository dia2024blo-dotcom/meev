import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText, looksSuspicious } from '@/lib/meev/sanitize'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TARGET_TYPES = new Set(['user', 'message', 'post', 'match'])
const REASONS = new Set(['harassment', 'nsfw', 'spam', 'impersonation', 'other'])

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const rl = rateLimit(`report:${g.user.id}`, 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const targetType = typeof body.targetType === 'string' && TARGET_TYPES.has(body.targetType) ? body.targetType : ''
    const reason = typeof body.reason === 'string' && REASONS.has(body.reason) ? body.reason : ''
    if (!targetType) return badRequest('Invalid report target type')
    if (!reason) return badRequest('Invalid report reason')

    const targetUserId = typeof body.targetUserId === 'string' && body.targetUserId ? body.targetUserId : null
    const targetId = typeof body.targetId === 'string' && body.targetId ? body.targetId : null
    const details = sanitizeText(body.details, 'details')

    if (looksSuspicious(details)) {
      await db.auditLog
        .create({ data: { id: newId(), userId: g.user.id, action: 'suspicious_report', ip: clientIp(req), meta: '{}' } })
        .catch(() => null)
    }

    await db.report.create({
      data: {
        id: newId(),
        reporterId: g.user.id,
        targetType,
        targetUserId,
        targetId,
        reason,
        details,
        status: 'open',
      },
    })
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
