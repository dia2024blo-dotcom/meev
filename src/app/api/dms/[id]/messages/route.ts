import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'
import { loadMessages } from '@/lib/meev/message-list'
import { broadcast } from '@/lib/meev/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    const conv = await db.dMConversation.findUnique({
      where: { id },
      include: { userA: true, userB: true },
    })
    if (!conv) return notFound('Conversation not found')
    if (conv.userAId !== me.id && conv.userBId !== me.id) return forbidden('You are not a participant in this conversation')

    const url = new URL(req.url)
    const beforeRaw = url.searchParams.get('before')
    const before = beforeRaw ? new Date(beforeRaw) : null
    const limitRaw = Number(url.searchParams.get('limit') || '50')
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50

    const { messages, hasMore } = await loadMessages({
      baseWhere: { conversationId: id },
      before,
      limit,
    })

    const partner = conv.userAId === me.id ? conv.userB : conv.userA

    // ---- v6 Instagram-style read receipts ("vu") ----
    // Opening the conversation = reading it: advance MY read pointer and
    // tell the partner live (dm:read) so their "✓✓ Seen" appears instantly.
    const myReadField = conv.userAId === me.id ? 'aReadAt' : 'bReadAt'
    const myReadAt = conv.userAId === me.id ? conv.aReadAt : conv.bReadAt
    const partnerReadAt = conv.userAId === me.id ? conv.bReadAt : conv.aReadAt
    const readNow = new Date()
    if (!myReadAt || myReadAt.getTime() < conv.lastMessageAt.getTime()) {
      try {
        await db.dMConversation.update({ where: { id: conv.id }, data: { [myReadField]: readNow } })
        await broadcast(`user:${partner.id}`, 'dm:read', {
          conversationId: conv.id,
          userId: me.id,
          at: readNow.toISOString(),
        })
      } catch {
        // read-receipt bookkeeping must never break message loading
      }
    }

    return Response.json({
      messages,
      partner: miniUser(partner),
      hasMore,
      // v3 streak flame + chat settings (muted = caller side)
      streakDays: conv.streakDays,
      themeKey: conv.themeKey,
      muted: conv.userAId === me.id ? conv.mutedA : conv.mutedB,
      // v6: the partner's read pointer (drives the "Seen" ticks)
      partnerReadAt: partnerReadAt ? partnerReadAt.toISOString() : null,
    })
  } catch (err) {
    return serverError(err)
  }
}
