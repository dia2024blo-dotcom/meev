import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'
import { sanitizeText } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REASONS = new Set(['harassment', 'nsfw', 'spam', 'impersonation', 'other'])

/** Used by the realtime matchmaking service (`match:report`). */
export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const reporterId = typeof body.reporterId === 'string' ? body.reporterId : ''
    const reason = typeof body.reason === 'string' && REASONS.has(body.reason) ? body.reason : ''
    const targetUserId = typeof body.targetUserId === 'string' && body.targetUserId ? body.targetUserId : null
    const details = sanitizeText(body.details, 'details')

    if (!reporterId) return badRequest('reporterId is required')
    if (!reason) return badRequest('Invalid report reason')

    const reporter = await db.user.findUnique({ where: { id: reporterId }, select: { id: true } })
    if (!reporter) return badRequest('Reporter not found')

    await db.report.create({
      data: {
        id: newId(),
        reporterId,
        targetType: 'match',
        targetUserId,
        targetId: typeof body.targetId === 'string' ? body.targetId : null,
        reason,
        details,
        status: 'open',
      },
    })
    await notifyUser(
      reporterId,
      'moderation',
      'Report received 🛡️',
      'Thanks for keeping Meev safe — our moderators will review it shortly.',
      { reason, targetUserId }
    )
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
