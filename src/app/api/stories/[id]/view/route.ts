import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const story = await db.story.findUnique({ where: { id }, select: { id: true } })
    if (!story) return notFound('Story not found')

    const existing = await db.storyView.findUnique({
      where: { storyId_userId: { storyId: id, userId: g.user.id } },
    })
    if (!existing) {
      await db.storyView.create({ data: { id: newId(), storyId: id, userId: g.user.id } })
    }
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
