import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/dms/[id] — v3 "delete for me".
 * Sets deletedA/deletedB (caller side) to now → the conversation is hidden
 * from the caller's list until a NEWER message arrives (lastMessageAt >
 * deletedAt). Messages stay; the partner keeps their copy.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    const conv = await db.dMConversation.findUnique({ where: { id } })
    if (!conv) return notFound('Conversation not found')
    if (conv.userAId !== me.id && conv.userBId !== me.id) {
      return forbidden('You are not a participant in this conversation')
    }
    await db.dMConversation.update({
      where: { id },
      data: conv.userAId === me.id ? { deletedA: new Date() } : { deletedB: new Date() },
    })
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
