import { db } from '@/lib/db'
import { serverError } from '@/lib/meev/guard'
import { requireUser } from '@/lib/meev/auth'
import { postDto, reactionCounts, myReactionMap } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Top 20 posts from the last 7 days ranked by likeCount*2 + commentCount*3. */
export async function GET(req: Request) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400_000)
    const posts = await db.post.findMany({
      where: { createdAt: { gt: weekAgo } },
      include: { author: true, _count: { select: { likes: true, comments: true } } },
      take: 120,
      orderBy: { createdAt: 'desc' },
    })

    const scored = posts
      .map((p) => ({ p, score: p._count.likes * 2 + p._count.comments * 3 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)

    const viewer = await requireUser(req)
    const ids = scored.map((s) => s.p.id)
    // v13: per-kind reaction counts + my current reaction (viewer optional)
    const countsByPost = await reactionCounts(ids)
    const mine = viewer ? await myReactionMap(viewer.id, ids) : new Map<string, never>()

    return Response.json({
      posts: scored.map((s) =>
        postDto(s.p, {
          reactions: countsByPost.get(s.p.id),
          myReaction: mine.get(s.p.id) ?? null,
          likedByMe: mine.has(s.p.id),
        })
      ),
    })
  } catch (err) {
    return serverError(err)
  }
}
