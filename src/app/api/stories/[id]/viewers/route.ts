// MEEV v6 — Instagram-style story viewers ("vu").
// GET /api/stories/:id/viewers → { viewers: [{ user, viewedAt }], count }
// Author-only: only the story owner can see who watched their story.

import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const story = await db.story.findUnique({ where: { id } })
    if (!story) return notFound('Story not found')
    if (story.authorId !== g.user.id) {
      return forbidden('يمكن لمالك القصة فقط رؤية من شاهدها / Only the story owner can see its viewers')
    }

    const views = await db.storyView.findMany({
      where: { storyId: id },
      orderBy: { viewedAt: 'desc' },
      take: 200,
    })

    // StoryView has no User relation (frozen schema) — resolve manually
    const userIds = [...new Set(views.map((v) => v.userId))]
    const users = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } } })
      : []
    const userById = new Map(users.map((u) => [u.id, u]))

    // v15: my own watch-row (the ring-clearing view when I watch my own
    // pulse) is hidden from the "vu" sheet — Instagram never lists you
    // among your own viewers, and the count stays the true audience size
    const external = views.filter((v) => v.userId !== g.user.id)

    return Response.json({
      count: external.length,
      viewers: external
        .filter((v) => userById.has(v.userId))
        .map((v) => ({
          user: miniUser(userById.get(v.userId)!),
          viewedAt: v.viewedAt.toISOString(),
        })),
    })
  } catch (err) {
    return serverError(err)
  }
}
