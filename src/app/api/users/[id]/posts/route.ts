import { db } from '@/lib/db'
import { serverError, notFound, pageParam } from '@/lib/meev/guard'
import { requireUser } from '@/lib/meev/auth'
import { postDto, reactionCounts, myReactionMap } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: param } = await ctx.params
    const key = param.toLowerCase()
    const user =
      (await db.user.findUnique({ where: { username: key } })) ||
      (await db.user.findUnique({ where: { id: param } }))
    if (!user) return notFound('User not found')

    const page = pageParam(new URL(req.url))
    const posts = await db.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { author: true, _count: { select: { likes: true, comments: true } } },
    })

    const viewer = await requireUser(req)
    const hasMore = posts.length > PAGE_SIZE
    const items = posts.slice(0, PAGE_SIZE)
    // v13: per-kind reaction counts + my current reaction
    const ids = items.map((p) => p.id)
    const countsByPost = await reactionCounts(ids)
    const mine = viewer ? await myReactionMap(viewer.id, ids) : new Map<string, never>()

    return Response.json({
      posts: items.map((p) =>
        postDto(p, {
          reactions: countsByPost.get(p.id),
          myReaction: mine.get(p.id) ?? null,
          likedByMe: mine.has(p.id),
        })
      ),
      hasMore,
    })
  } catch (err) {
    return serverError(err)
  }
}
