import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound } from '@/lib/meev/guard'
import { createMessage } from '@/lib/meev/messages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    const server = await db.server.findUnique({ where: { id } })
    if (!server) return notFound('Server not found')

    const existing = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: me.id } },
    })
    if (!existing) {
      await db.serverMember.create({
        data: { id: newId(), serverId: id, userId: me.id, role: 'member' },
      })

      // system message in #general
      const general = await db.channel.findFirst({
        where: { serverId: id, name: 'general' },
        orderBy: { position: 'asc' },
      })
      if (general) {
        await createMessage({
          scope: 'server',
          channelId: general.id,
          authorId: me.id,
          content: `${me.displayName} joined the party 🎉`,
          kind: 'system',
          processCommands: false,
        }).catch(() => null)
      }
    }
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
