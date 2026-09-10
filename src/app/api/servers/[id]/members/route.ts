import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const server = await db.server.findUnique({ where: { id } })
    if (!server) return notFound('Server not found')

    const membership = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: g.user.id } },
    })
    if (!membership) return forbidden('Join this server to see its members')

    const members = await db.serverMember.findMany({
      where: { serverId: id },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })

    const roleOrder: Record<string, number> = { owner: 0, admin: 1, mod: 2, member: 3 }
    members.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))

    return Response.json({
      members: members.map((m) => ({ user: miniUser(m.user), role: m.role })),
    })
  } catch (err) {
    return serverError(err)
  }
}
