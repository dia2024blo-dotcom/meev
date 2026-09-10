// MEEV v5 — /api/admin/command: the MeevCMD endpoint.
// POST { command: string } → { ok, lines } (bilingual terminal output).
// Access: any staff role (support+). Permissions enforced per command
// in lib/meev/admin.ts (owner > admin > moderator > support > user).

import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { runAdminCommand, roleRank } from '@/lib/meev/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    if (roleRank(g.user.role) < 1) {
      return Response.json(
        { ok: false, lines: ['⛔ هذه اللوحة لفريق الإدارة فقط / staff only.'] },
        { status: 403 },
      )
    }
    const body = (await req.json().catch(() => ({}))) as { command?: unknown }
    const command = typeof body.command === 'string' ? body.command : ''
    if (!command.trim()) {
      return Response.json({ ok: false, lines: ['⛔ أمر فارغ — اكتب help'] })
    }
    const result = await runAdminCommand(g.user, command.slice(0, 300))
    await db.user.update({ where: { id: g.user.id }, data: { lastActiveAt: new Date() } }).catch(() => null)
    return Response.json(result)
  } catch (err) {
    return serverError(err)
  }
}
