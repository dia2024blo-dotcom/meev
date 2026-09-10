import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const server = await db.server.findUnique({ where: { id } })
    if (!server) return notFound('Server not found')

    if (server.ownerId === g.user.id) {
      return forbidden('Owners cannot leave their own server — transfer ownership or delete it instead')
    }

    await db.serverMember
      .deleteMany({ where: { serverId: id, userId: g.user.id } })
      .catch(() => null)
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
