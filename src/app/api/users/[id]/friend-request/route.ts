import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound, badRequest, forbidden } from '@/lib/meev/guard'
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
    if (target.id === me.id) return badRequest('You cannot befriend yourself')

    // blocked either way → 403
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: me.id, blockedId: target.id },
          { blockerId: target.id, blockedId: me.id },
        ],
      },
    })
    if (blocked) return forbidden('You cannot send a friend request to this user')

    // reverse pending → auto-accept both sides
    const reverse = await db.friendRequest.findFirst({
      where: { fromId: target.id, toId: me.id, status: 'pending' },
    })
    if (reverse) {
      await db.friendRequest.update({
        where: { id: reverse.id },
        data: { status: 'accepted', respondedAt: new Date() },
      })
      await notifyUser(
        target.id,
        'friend_request',
        `${me.displayName} accepted your friend request`,
        'You are now Meev friends 🎉',
        { userId: me.id, username: me.username, status: 'friends' }
      )
      return Response.json({ status: 'friends' })
    }

    // already pending from me
    const mine = await db.friendRequest.findFirst({
      where: { fromId: me.id, toId: target.id, status: 'pending' },
    })
    if (mine) return Response.json({ status: 'pending_out' })

    // already friends
    const friends = await db.friendRequest.findFirst({
      where: { status: 'accepted', OR: [{ fromId: me.id, toId: target.id }, { fromId: target.id, toId: me.id }] },
    })
    if (friends) return Response.json({ status: 'friends' })

    await db.friendRequest.create({
      data: { id: newId(), fromId: me.id, toId: target.id, status: 'pending' },
    })
    await notifyUser(
      target.id,
      'friend_request',
      `${me.displayName} wants to be your friend`,
      'Open Meev to accept or decline.',
      { userId: me.id, username: me.username, status: 'pending' }
    )
    return Response.json({ status: 'pending_out' })
  } catch (err) {
    return serverError(err)
  }
}
