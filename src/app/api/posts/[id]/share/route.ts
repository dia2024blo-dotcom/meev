// MEEV v13 — share a post with friends (Facebook-style "Send to friend").
// GET  /api/posts/:id/share → the people I can share with (accepted friends
//      first, then people I follow — the sheet is never empty).
// POST /api/posts/:id/share { targetUserId } → lands a kind:'post_share'
//      message in the DM with that friend, carrying a compact post snapshot
//      (author + content excerpt + image) so the receiver renders it without
//      an extra fetch. Mirrors the story_react pattern (createMessage +
//      dm:new broadcast + notification).

import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest, notFound, forbidden } from '@/lib/meev/guard'
import { createMessage, MessageError } from '@/lib/meev/messages'
import { notifyUser, broadcast } from '@/lib/meev/realtime'
import { miniUser, type MiniUser } from '@/lib/meev/dto'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { levelFromXp } from '@/lib/meev/xp'
import type { User } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** People I can share with: accepted friends first, then people I follow. */
async function shareTargets(me: User): Promise<(MiniUser & { isFriend: boolean })[]> {
  const [requests, follows, blocks] = await Promise.all([
    db.friendRequest.findMany({
      where: { status: 'accepted', OR: [{ fromId: me.id }, { toId: me.id }] },
      select: { fromId: true, toId: true },
    }),
    db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true }, take: 150 }),
    db.block.findMany({ where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] }, select: { blockerId: true, blockedId: true } }),
  ])
  const blocked = new Set<string>()
  for (const b of blocks) {
    blocked.add(b.blockerId)
    blocked.add(b.blockedId)
  }

  const friendIds = new Set<string>()
  for (const r of requests) {
    const other = r.fromId === me.id ? r.toId : r.fromId
    if (other !== me.id && !blocked.has(other)) friendIds.add(other)
  }
  const followedIds = new Set<string>()
  for (const f of follows) {
    if (f.followingId !== me.id && !blocked.has(f.followingId)) followedIds.add(f.followingId)
  }

  // friends are the primary audience; followed-but-not-friend users follow
  const ids = [...friendIds, ...[...followedIds].filter((id) => !friendIds.has(id))].slice(0, 200)
  if (ids.length === 0) return []
  const users = await db.user.findMany({ where: { id: { in: ids } } })
  const byId = new Map(users.map((u) => [u.id, u]))
  const out: (MiniUser & { isFriend: boolean })[] = []
  for (const id of ids) {
    const u = byId.get(id)
    if (!u) continue
    out.push({ ...miniUser(u), isFriend: friendIds.has(id) })
  }
  return out
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('Post not found')
    const friends = await shareTargets(g.user)
    return Response.json({ friends })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    // sharing is light but capped: 20 / 10 minutes
    const rl = rateLimit(`post-share:${me.id}`, 20, 600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const post = await db.post.findUnique({
      where: { id },
      include: { author: true },
    })
    if (!post) return notFound('Post not found')

    const body = await readJson(req)
    const targetId = typeof body.targetUserId === 'string' ? body.targetUserId : ''
    if (!targetId) return badRequest('targetUserId is required')
    if (targetId === me.id) return badRequest('لا يمكنك مشاركة منشور مع نفسك / You cannot share with yourself')
    const target = await db.user.findUnique({ where: { id: targetId } })
    if (!target) return notFound('Target user not found')

    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: me.id, blockedId: targetId },
          { blockerId: targetId, blockedId: me.id },
        ],
      },
    })
    if (blocked) return forbidden('You can no longer message this user')

    // find-or-create the DM (deterministic ordering — story_react pattern)
    const userAId = me.id < targetId ? me.id : targetId
    const userBId = me.id < targetId ? targetId : me.id
    let conv = await db.dMConversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } })
    if (!conv) {
      conv = await db.dMConversation.create({ data: { id: newId(), userAId, userBId } })
    }

    // compact snapshot — the receiving client renders without an extra fetch
    const snapshot = {
      id: post.id,
      kind: post.kind,
      content: post.content.slice(0, 140),
      imageUrl: post.kind === 'image' ? post.imageUrl : null,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarSeed: post.author.avatarSeed,
        avatarPhoto: post.author.avatarPhoto ?? null,
        level: levelFromXp(post.author.xp),
      },
    }

    const dto = await createMessage({
      scope: 'dm',
      conversationId: conv.id,
      authorId: me.id,
      kind: 'post_share',
      content: post.content.slice(0, 80) || 'Shared post',
      meta: { post: snapshot },
    })

    // live delivery to both sides (this route bypasses the socket pipeline)
    try {
      await broadcast(`dm:${conv.id}`, 'dm:new', { message: dto, conversationId: conv.id })
      await broadcast(`user:${target.id}`, 'dm:new', { message: dto, conversationId: conv.id })
      await broadcast(`user:${me.id}`, 'dm:new', { message: dto, conversationId: conv.id })
    } catch {
      // delivery is best-effort — the message is already persisted
    }

    // let the friend know
    await notifyUser(
      target.id,
      'system',
      `${me.displayName} شارك معك منشوراً / shared a post with you`,
      snapshot.content ? `«${snapshot.content.slice(0, 60)}»` : '',
      { conversationId: conv.id, postId: post.id, username: me.username },
    ).catch(() => null)

    return Response.json({ ok: true, conversationId: conv.id, message: dto })
  } catch (err) {
    if (err instanceof MessageError) {
      return Response.json({ error: err.message }, { status: err.status })
    }
    return serverError(err)
  }
}
