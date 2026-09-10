// MEEV v20 — /api/admin/logs: the audit trail feed for the staff console.
// GET ?page=1 → { logs: [{ id, action, actionAr, summary, by, createdAt }] }
//
// v20: OWNER-ONLY (the boss's oversight tool — staff actions are visible
// to the boss, not to each other) and now includes ticket replies
// (`ticket_reply`), so "who replied to which ticket" is answered here too.

import { guard, serverError, pageParam } from '@/lib/meev/guard'
import { roleRank, ACTION_LABELS, summarizeAudit } from '@/lib/meev/admin'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    if (roleRank(g.user.role) < 5) {
      return Response.json({ error: 'owner only' }, { status: 403 })
    }
    const url = new URL(req.url)
    const limit = Math.min(100, Math.max(1, pageParam(url) * 20))
    const rows = await db.auditLog.findMany({
      where: { OR: [{ action: { startsWith: 'admin_' } }, { action: 'ticket_reply' }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    // resolve actor usernames in one pass (AuditLog has no User relation)
    const actorIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))]
    const actors = actorIds.length
      ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } })
      : []
    const nameById = new Map(actors.map((a) => [a.id, a.username]))
    return Response.json({
      logs: rows.map((r) => {
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(r.meta || '{}') as Record<string, unknown>
        } catch {
          meta = {}
        }
        return {
          id: r.id,
          action: r.action,
          actionAr: ACTION_LABELS[r.action] ?? r.action,
          summary: summarizeAudit(r.action, meta),
          by: (r.userId && nameById.get(r.userId)) || 'system',
          createdAt: r.createdAt.toISOString(),
        }
      }),
    })
  } catch (err) {
    return serverError(err)
  }
}
