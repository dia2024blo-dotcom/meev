import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound, badRequest } from '@/lib/meev/guard'

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
    if (target.id === me.id) return badRequest('You cannot block yourself')

    const existing = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: target.id } },
    })
    if (!existing) {
      await db.block.create({ data: { id: newId(), blockerId: me.id, blockedId: target.id } })
    }

    // auto-decline pending requests between the two, unfollow both ways
    await db.friendRequest.updateMany({
      where: {
        status: 'pending',
        OR: [{ fromId: me.id, toId: target.id }, { fromId: target.id, toId: me.id }],
      },
      data: { status: 'declined', respondedAt: new Date() },
    })
    await db.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } }).catch(() => null)
    await db.follow.deleteMany({ where: { followerId: target.id, followingId: me.id } }).catch(() => null)

    return Response.json({ blocked: true })
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id: param } = await ctx.params
    const target = await resolveTarget(param)
    if (!target) return notFound('User not found')

    await db.block
      .deleteMany({ where: { blockerId: g.user.id, blockedId: target.id } })
      .catch(() => null)
    return Response.json({ blocked: false })
  } catch (err) {
    return serverError(err)
  }
}
