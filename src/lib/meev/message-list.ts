// MEEV — Message list loader. The Reaction model has no User relation
// (frozen schema), so reactions + their users are joined manually and
// mapped into the contract MessageDTO shape.

import { db } from '@/lib/db'
import { messageDto, type MessageDTO, type ReactionWithUser } from './dto'

export async function loadMessages(params: {
  baseWhere: Record<string, unknown>
  before?: Date | null
  limit: number
}): Promise<{ messages: MessageDTO[]; hasMore: boolean }> {
  const { baseWhere, before, limit } = params

  const where: Record<string, unknown> = { ...baseWhere, deletedAt: null }
  if (before && !Number.isNaN(before.getTime())) where.createdAt = { lt: before }

  const rows = await db.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { author: true },
  })
  if (rows.length === 0) return { messages: [], hasMore: false }

  // manual join: reactions → users
  const messageIds = rows.map((m) => m.id)
  const reactions = await db.reaction.findMany({ where: { messageId: { in: messageIds } } })
  const userIds = [...new Set(reactions.map((r) => r.userId))]
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } } }) : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const reactionsByMessage = new Map<string, ReactionWithUser[]>()
  for (const r of reactions) {
    const user = userMap.get(r.userId)
    if (!user) continue
    const arr = reactionsByMessage.get(r.messageId) || []
    arr.push({ emoji: r.emoji, user })
    reactionsByMessage.set(r.messageId, arr)
  }

  // oldest → newest for natural chat rendering
  const items = [...rows].reverse().map((m) => ({
    ...m,
    reactions: reactionsByMessage.get(m.id) || [],
  }))

  const oldest = rows[rows.length - 1]
  const olderCount = await db.message.count({
    where: { ...baseWhere, deletedAt: null, createdAt: { lt: oldest.createdAt } },
  })

  return { messages: items.map((m) => messageDto(m)), hasMore: olderCount > 0 }
}
