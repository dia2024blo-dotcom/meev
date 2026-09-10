import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } })
    if (!post) return notFound('Post not found')
    if (post.authorId !== g.user.id && g.user.role !== 'moderator' && g.user.role !== 'admin') {
      return forbidden('You can only delete your own posts')
    }

    await db.post.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
