import { db } from '@/lib/db'
import { serverError, notFound } from '@/lib/meev/guard'
import { requireUser } from '@/lib/meev/auth'
import { publicUser } from '@/lib/meev/serialize'
import { userStats, userBadges } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Relationship = {
  following: boolean
  isFollowingMe: boolean
  friendship: 'none' | 'pending_out' | 'pending_in' | 'friends' | 'blocked_out' | 'blocked_in'
}

/** Resolve ?param as username first, then as id (contract path is /api/users/[username]). */
async function resolveUser(param: string) {
  const key = param.toLowerCase()
  return (
    (await db.user.findUnique({ where: { username: key } })) ||
    (await db.user.findUnique({ where: { id: param } }))
  )
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: param } = await ctx.params
    const user = await resolveUser(param)
    if (!user) return notFound('User not found')

    const viewer = await requireUser(req)
    let relationship: Relationship | undefined
    let viewerIsFriendOrFollower = false

    if (viewer && viewer.id !== user.id) {
      const [iFollow, theyFollow, blockedOut, blockedIn, fr] = await Promise.all([
        db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } } }),
        db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: viewer.id } } }),
        db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id } } }),
        db.block.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: viewer.id } } }),
        db.friendRequest.findFirst({
          where: { OR: [{ fromId: viewer.id, toId: user.id }, { fromId: user.id, toId: viewer.id }] },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      let friendship: Relationship['friendship'] = 'none'
      if (blockedOut) friendship = 'blocked_out'
      else if (blockedIn) friendship = 'blocked_in'
      else if (fr?.status === 'accepted') friendship = 'friends'
      else if (fr?.status === 'pending') friendship = fr.fromId === viewer.id ? 'pending_out' : 'pending_in'

      relationship = {
        following: !!iFollow,
        isFollowingMe: !!theyFollow,
        friendship,
      }
      viewerIsFriendOrFollower = !!iFollow || !!theyFollow || friendship === 'friends'
    }

    const [stats, badges] = await Promise.all([userStats(user.id), userBadges(user.id)])
    return Response.json({
      user: publicUser(user, { viewerIsSelf: viewer?.id === user.id, viewerIsFriendOrFollower, stats, badges }),
      relationship,
    })
  } catch (err) {
    return serverError(err)
  }
}
