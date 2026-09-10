import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest, notFound, forbidden } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const conversations = await db.dMConversation.findMany({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
      orderBy: { lastMessageAt: 'desc' },
      include: { userA: true, userB: true },
    })
    if (conversations.length === 0) return Response.json({ conversations: [] })

    // hide conversations with users I blocked or who blocked me
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
      select: { blockerId: true, blockedId: true },
    })
    const blockPairs = new Set(blocks.map((b) => `${b.blockerId}:${b.blockedId}`))
    const isBlocked = (a: string, b: string) => blockPairs.has(`${a}:${b}`) || blockPairs.has(`${b}:${a}`)

    const visible = conversations.filter((c) => {
      if (isBlocked(c.userAId, c.userBId)) return false
      // v3 "delete for me": hidden until a message NEWER than the deletion arrives
      const deletedAt = c.userAId === me.id ? c.deletedA : c.deletedB
      return !(deletedAt && deletedAt.getTime() >= c.lastMessageAt.getTime())
    })
    const convIds = visible.map((c) => c.id)

    const lastByConv = new Map<string, { content: string; kind: string; authorId: string; createdAt: Date }>()
    for (const id of convIds) {
      const last = await db.message.findFirst({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
      })
      if (last) {
        lastByConv.set(id, { content: last.content, kind: last.kind, authorId: last.authorId, createdAt: last.createdAt })
      }
    }

    return Response.json({
      conversations: visible.map((c) => {
        const partner = c.userAId === me.id ? c.userB : c.userA
        const last = lastByConv.get(c.id)
        const myReadAt = c.userAId === me.id ? c.aReadAt : c.bReadAt
        const partnerReadAt = c.userAId === me.id ? c.bReadAt : c.aReadAt
        return {
          id: c.id,
          partner: miniUser(partner),
          lastMessage: last
            ? { content: last.content, kind: last.kind, authorId: last.authorId, createdAt: last.createdAt.toISOString() }
            : null,
          updatedAt: c.lastMessageAt.toISOString(),
          // v3 streak flame + chat settings (muted = caller side)
          streakDays: c.streakDays,
          themeKey: c.themeKey,
          muted: c.userAId === me.id ? c.mutedA : c.mutedB,
          // v6 Instagram-style read receipts ("vu")
          myReadAt: myReadAt ? myReadAt.toISOString() : null,
          partnerReadAt: partnerReadAt ? partnerReadAt.toISOString() : null,
        }
      }),
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const body = await readJson(req)
    const url = new URL(req.url)

    let targetId = typeof body.targetUserId === 'string' ? body.targetUserId : ''
    if (!targetId) {
      const targetUsername = url.searchParams.get('targetUsername') || (typeof body.targetUsername === 'string' ? body.targetUsername : '')
      if (targetUsername) {
        const target = await db.user.findUnique({ where: { username: targetUsername.toLowerCase() } })
        if (target) targetId = target.id
      }
    } else {
      const target = await db.user.findUnique({ where: { id: targetId } })
      if (target) targetId = target.id
      else {
        const byName = await db.user.findUnique({ where: { username: targetId.toLowerCase() } })
        if (byName) targetId = byName.id
      }
    }

    if (!targetId) return notFound('User not found')
    if (targetId === me.id) return badRequest('You cannot start a conversation with yourself')

    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: me.id, blockedId: targetId },
          { blockerId: targetId, blockedId: me.id },
        ],
      },
    })
    if (blocked) return forbidden('You can no longer message this user')

    // deterministic ordering: smaller id is userA
    const userAId = me.id < targetId ? me.id : targetId
    const userBId = me.id < targetId ? targetId : me.id

    const existing = await db.dMConversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    })
    if (existing) return Response.json({ conversationId: existing.id })

    const conv = await db.dMConversation.create({
      data: { id: newId(), userAId, userBId },
    })
    return Response.json({ conversationId: conv.id })
  } catch (err) {
    return serverError(err)
  }
}
