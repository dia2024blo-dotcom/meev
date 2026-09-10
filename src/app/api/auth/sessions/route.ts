import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const sessions = await db.session.findMany({
      where: { userId: g.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return Response.json({
      sessions: sessions.map((s, i) => ({
        id: s.id,
        device: s.device,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        current: i === 0, // newest session = current chain
      })),
    })
  } catch (err) {
    return serverError(err)
  }
}
