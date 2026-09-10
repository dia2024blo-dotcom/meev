// MEEV v2 — Blocked users list for the settings privacy section.
// GET /api/users/blocklist → { blocked: MiniUser[] }

import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const rows = await db.block.findMany({
      where: { blockerId: g.user.id },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return Response.json({ blocked: rows.map((r) => miniUser(r.blocked)) })
  } catch (err) {
    return serverError(err)
  }
}
