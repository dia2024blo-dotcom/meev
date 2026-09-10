// MEEV v13 security pass — internal room-membership verification.
// POST /api/internal/verify-access (service key) { userId, scope, conversationId?, channelId? }
//   → { allowed: boolean }
// Used by the realtime mini-service BEFORE letting a socket join a `dm:*` /
// `server:*` room. Previously any authenticated socket could join any room
// by id (snowflake ids are guessable) and silently LISTEN to a conversation
// or server channel it is not part of — sends were already membership-checked
// by /api/internal/messages, but receives were not. This closes the gap.
// Fails closed on any input problem.

import { db } from '@/lib/db'
import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) return Response.json({ allowed: false })

    if (body.scope === 'server') {
      const channelId = typeof body.channelId === 'string' ? body.channelId : ''
      if (!channelId) return Response.json({ allowed: false })
      const channel = await db.channel.findUnique({ where: { id: channelId }, select: { serverId: true } })
      if (!channel) return Response.json({ allowed: false })
      const membership = await db.serverMember.findUnique({
        where: { serverId_userId: { serverId: channel.serverId, userId } },
        select: { id: true },
      })
      return Response.json({ allowed: !!membership })
    }

    // default / 'dm'
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
    if (!conversationId) return Response.json({ allowed: false })
    const conv = await db.dMConversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    })
    if (!conv) return Response.json({ allowed: false })
    if (conv.userAId !== userId && conv.userBId !== userId) return Response.json({ allowed: false })
    // a block in either direction ends the listening right too
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: conv.userAId, blockedId: conv.userBId },
          { blockerId: conv.userBId, blockedId: conv.userAId },
        ],
      },
      select: { id: true },
    })
    if (blocked) return Response.json({ allowed: false })
    return Response.json({ allowed: true })
  } catch (err) {
    return serverError(err)
  }
}
