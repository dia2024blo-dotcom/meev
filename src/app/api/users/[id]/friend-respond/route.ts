import { db } from '@/lib/db'
import { guard, readJson, serverError, notFound } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveTarget(param: string) {
  return (
    (await db.user.findUnique({ where: { id: param } })) ||
    (await db.user.findUnique({ where: { username: param.toLowerCase() } }))
  )
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id: param } = await ctx.params
    const target = await resolveTarget(param)
    if (!target) return notFound('User not found')

    const body = await readJson(req)
    const accept = body.accept === true

    // find an incoming pending request from target to me
    const incoming = await db.friendRequest.findFirst({
      where: { fromId: target.id, toId: me.id, status: 'pending' },
    })
    if (!incoming) return Response.json({ status: 'none' })

    await db.friendRequest.update({
      where: { id: incoming.id },
      data: { status: accept ? 'accepted' : 'declined', respondedAt: new Date() },
    })

    if (accept) {
      await notifyUser(
        target.id,
        'friend_request',
        `${me.displayName} accepted your friend request`,
        'You are now Meev friends 🎉',
        { userId: me.id, username: me.username, status: 'friends' }
      )
      return Response.json({ status: 'friends' })
    }
    return Response.json({ status: 'none' })
  } catch (err) {
    return serverError(err)
  }
}
