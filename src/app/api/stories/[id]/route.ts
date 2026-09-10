import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'
import { broadcast } from '@/lib/meev/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * v8: DELETE /api/stories/[id] — the author removes one of their own stories.
 * Only the story's author may delete it (the owner's moderation path is
 * MeevCMD `delete`). Cascades StoryView rows via the schema relation.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const story = await db.story.findUnique({ where: { id }, select: { id: true, authorId: true } })
    if (!story) return notFound('Story not found')
    if (story.authorId !== g.user.id) return forbidden('You can only delete your own story')

    await db.story.delete({ where: { id } })

    // live nudge so open story viewers close this story gracefully
    await broadcast(`user:${g.user.id}`, 'story:deleted', { storyId: id }).catch(() => null)

    return Response.json({ ok: true, storyId: id })
  } catch (err) {
    return serverError(err)
  }
}
