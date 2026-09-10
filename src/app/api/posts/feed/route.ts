import { db } from '@/lib/db'
import { guard, serverError, pageParam } from '@/lib/meev/guard'
import { postDto, reactionCounts, myReactionMap } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

/** author ids I follow (for the follow chip in post headers). */
async function followedByMeSet(userId: string, authorIds: string[]): Promise<Set<string>> {
  if (authorIds.length === 0) return new Set()
  const rows = await db.follow.findMany({
    where: { followerId: userId, followingId: { in: authorIds } },
    select: { followingId: true },
  })
  return new Set(rows.map((r) => r.followingId))
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const url = new URL(req.url)
    const page = pageParam(url)
    const filter = url.searchParams.get('filter') === 'following' ? 'following' : 'all'

    // hide posts from authors I blocked
    const blocks = await db.block.findMany({
      where: { blockerId: me.id },
      select: { blockedId: true },
    })
    const blockedIds = blocks.map((b) => b.blockedId)

    let authorIds: string[] | null = null
    if (filter === 'following') {
      const follows = await db.follow.findMany({
        where: { followerId: me.id },
        select: { followingId: true },
      })
      authorIds = [me.id, ...follows.map((f) => f.followingId)]
    }

    const where: Record<string, unknown> = {}
    if (authorIds) {
      where.authorId = { in: authorIds.filter((id) => !blockedIds.includes(id)) }
    } else if (blockedIds.length > 0) {
      where.authorId = { notIn: blockedIds }
    }

    const posts = await db.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { author: true, _count: { select: { likes: true, comments: true } } },
    })

    const hasMore = posts.length > PAGE_SIZE
    const items = posts.slice(0, PAGE_SIZE)
    // v13: per-kind reaction counts + my current reaction + follow state
    const ids = items.map((p) => p.id)
    const [countsByPost, mine, following] = await Promise.all([
      reactionCounts(ids),
      myReactionMap(me.id, ids),
      followedByMeSet(me.id, items.map((p) => p.authorId)),
    ])

    return Response.json({
      posts: items.map((p) =>
        postDto(p, {
          reactions: countsByPost.get(p.id),
          myReaction: mine.get(p.id) ?? null,
          likedByMe: mine.has(p.id),
          authorFollowedByMe: following.has(p.authorId),
        })
      ),
      hasMore,
    })
  } catch (err) {
    return serverError(err)
  }
}
