import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound, badRequest } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Resolve target by id first (contract), then username. */
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
    const { id: param } = await ctx.params
    const target = await resolveTarget(param)
    if (!target) return notFound('User not found')
    if (target.id === g.user.id) return badRequest('You cannot follow yourself')

    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: g.user.id, followingId: target.id } },
    })
    if (!existing) {
      await db.follow.create({
        data: { id: newId(), followerId: g.user.id, followingId: target.id },
      })
      await notifyUser(
        target.id,
        'follow',
        `${g.user.displayName} started following you`,
        '',
        { userId: g.user.id, username: g.user.username }
      )
    }
    return Response.json({ following: true })
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

    await db.follow
      .deleteMany({ where: { followerId: g.user.id, followingId: target.id } })
      .catch(() => null)
    return Response.json({ following: false })
  } catch (err) {
    return serverError(err)
  }
}
