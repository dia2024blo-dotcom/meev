import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'
import { loadMessages } from '@/lib/meev/message-list'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id, cid } = await ctx.params
    const channel = await db.channel.findUnique({ where: { id: cid } })
    if (!channel || channel.serverId !== id) return notFound('Channel not found')

    const membership = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: me.id } },
    })
    if (!membership) return forbidden('Join this server to read its channels')

    const url = new URL(req.url)
    const beforeRaw = url.searchParams.get('before')
    const before = beforeRaw ? new Date(beforeRaw) : null
    const limitRaw = Number(url.searchParams.get('limit') || '50')
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50

    const { messages, hasMore } = await loadMessages({
      baseWhere: { channelId: cid },
      before,
      limit,
    })

    return Response.json({ messages, hasMore })
  } catch (err) {
    return serverError(err)
  }
}
