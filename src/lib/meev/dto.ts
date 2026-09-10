// MEEV — DTO mappers (contract shapes): MiniUser, MessageDTO, PostDTO,
// CommentDTO, GiftDTO, NotificationDTO + stats/badge loaders.

import type { Comment, Gift, GiftCatalog, Message, Notification, Post, User } from '@prisma/client'
import { db } from '@/lib/db'
import { levelFromXp } from './xp'
import { publicUser, type PublicUser } from './serialize'

export type MiniUser = {
  id: string
  username: string
  displayName: string
  avatarSeed: string
  level: number
  presence: string
  nameColor: string
  isBot: boolean
  // v5 staff identity (badges next to names)
  role?: string
  verified?: boolean
  // v2 cosmetics (optional so older/realtime-built Minis still typecheck)
  avatarPhoto?: string | null
  nameGradient?: string
  frameKey?: string
  badgeShop?: string
  avatarAcc?: string
  // v3 cosmetics
  coverKey?: string
  profileEffect?: string
  avatarAnim?: boolean
  // v11: name-effect slot (username.tsx renders it)
  nameFx?: string
  // v4 Instagram-style note (thought bubble above the profile)
  note?: string | null
}

export function miniUser(
  u: Pick<
    User,
    | 'id' | 'username' | 'displayName' | 'avatarSeed' | 'xp' | 'presence' | 'nameColor' | 'isBot'
    | 'avatarPhoto' | 'nameGradient' | 'frameKey' | 'badgeShop' | 'avatarAcc'
    | 'coverKey' | 'profileEffect' | 'avatarAnim' | 'note'
    | 'role' | 'verifiedAt' | 'lastActiveAt' | 'nameFx'
  > & { avatarPhoto?: string | null }
): MiniUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarSeed: u.avatarSeed,
    level: levelFromXp(u.xp),
    presence: effectivePresence(u),
    nameColor: u.nameColor,
    isBot: u.isBot,
    role: u.role,
    verified: !!u.verifiedAt,
    avatarPhoto: u.avatarPhoto ?? null,
    nameGradient: u.nameGradient || '',
    frameKey: u.frameKey || '',
    badgeShop: u.badgeShop || '',
    avatarAcc: u.avatarAcc || '',
    coverKey: u.coverKey || '',
    profileEffect: u.profileEffect || '',
    avatarAnim: !!u.avatarAnim,
    nameFx: u.nameFx || '',
    note: u.note ?? null,
  }
}

// ------------------------- v6: REAL presence -------------------------

/**
 * A user is only shown online/busy/dnd when they were ACTUALLY active
 * recently (heartbeat / API traffic / socket). A stale DB `presence`
 * value (e.g. the service restarted, or the browser crashed) must never
 * lie "online" — that was the v6 bug report. Bots are always awake.
 */
const PRESENCE_STALE_MS = 3 * 60_000

export function effectivePresence(
  u: Pick<User, 'presence' | 'lastActiveAt' | 'isBot'>,
): string {
  if (u.isBot) return u.presence || 'online'
  if (u.presence === 'offline' || u.presence === 'hidden') return 'offline'
  if (!u.lastActiveAt) return 'offline'
  return Date.now() - u.lastActiveAt.getTime() <= PRESENCE_STALE_MS ? u.presence : 'offline'
}

// ------------------------- stats & badges -------------------------

export async function userStats(userId: string): Promise<{ followers: number; following: number; posts: number; friends: number }> {
  const [followers, following, posts, friends] = await Promise.all([
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
    db.post.count({ where: { authorId: userId } }),
    db.friendRequest.count({ where: { status: 'accepted', OR: [{ fromId: userId }, { toId: userId }] } }),
  ])
  return { followers, following, posts, friends }
}

export async function userBadges(userId: string): Promise<{ key: string; earnedAt: string }[]> {
  const rows = await db.userBadge.findMany({ where: { userId }, orderBy: { earnedAt: 'asc' } })
  return rows.map((b) => ({ key: b.badgeKey, earnedAt: b.earnedAt.toISOString() }))
}

/** PublicUser for the authenticated self (with stats + badges + privacy). */
export async function selfUser(u: User): Promise<PublicUser> {
  const [stats, badges] = await Promise.all([userStats(u.id), userBadges(u.id)])
  return publicUser(u, { viewerIsSelf: true, stats, badges })
}

// ------------------------- messages -------------------------

export type MessageDTO = {
  id: string
  scope: 'dm' | 'server'
  conversationId: string | null
  channelId: string | null
  author: MiniUser
  content: string
  kind: 'text' | 'sticker' | 'gift' | 'system' | 'poll' | 'voice' | 'game'
  attachmentUrl: string | null
  meta: unknown
  createdAt: string
  reactions: { emoji: string; users: MiniUser[] }[]
}

function safeParseJson(s: string | null): unknown {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** Lightweight reaction input — the DB Reaction row has no User relation (frozen schema). */
export type ReactionWithUser = { emoji: string; user: User }

export function messageDto(
  m: Omit<Message, 'reactions'> & { author: User; reactions?: ReactionWithUser[] }
): MessageDTO {
  const grouped = new Map<string, MiniUser[]>()
  for (const r of m.reactions || []) {
    const arr = grouped.get(r.emoji) || []
    arr.push(miniUser(r.user))
    grouped.set(r.emoji, arr)
  }
  return {
    id: m.id,
    scope: m.scope as 'dm' | 'server',
    conversationId: m.conversationId,
    channelId: m.channelId,
    author: miniUser(m.author),
    content: m.content,
    kind: m.kind as MessageDTO['kind'],
    attachmentUrl: m.attachmentUrl,
    meta: safeParseJson(m.meta),
    createdAt: m.createdAt.toISOString(),
    reactions: [...grouped.entries()].map(([emoji, users]) => ({ emoji, users })),
  }
}

// ------------------------- posts -------------------------

export type ReactionCounts = { like: number; love: number; care: number; laugh: number; wow: number; sad: number; angry: number }
export type ReactionKind = 'like' | 'love' | 'care' | 'laugh' | 'wow' | 'sad' | 'angry'
export const REACTION_KINDS: ReactionKind[] = ['like', 'love', 'care', 'laugh', 'wow', 'sad', 'angry']

export function emptyReactionCounts(): ReactionCounts {
  return { like: 0, love: 0, care: 0, laugh: 0, wow: 0, sad: 0, angry: 0 }
}

export type PostDTO = {
  id: string
  content: string
  imageUrl: string | null
  kind: 'text' | 'image'
  createdAt: string
  author: MiniUser
  likeCount: number
  commentCount: number
  likedByMe: boolean
  // v13: Facebook-style reactions (like | love | laugh | sad)
  reactions: ReactionCounts
  myReaction: ReactionKind | null
  // v13 feed: do I follow the author? (follow chip in post headers)
  authorFollowedByMe?: boolean
}

export type PostWithAuthor = Post & { author: User; _count?: { likes: number; comments: number } }

export function postDto(
  p: PostWithAuthor,
  opts: { likeCount?: number; commentCount?: number; likedByMe?: boolean; reactions?: ReactionCounts; myReaction?: ReactionKind | null; authorFollowedByMe?: boolean } = {},
): PostDTO {
  const total = opts.reactions
    ? REACTION_KINDS.reduce((sum, k) => sum + (opts.reactions?.[k] ?? 0), 0)
    : opts.likeCount ?? p._count?.likes ?? 0
  return {
    id: p.id,
    content: p.content,
    imageUrl: p.imageUrl,
    kind: p.kind as 'text' | 'image',
    createdAt: p.createdAt.toISOString(),
    author: miniUser(p.author),
    // legacy fields stay = the TOTAL reaction count (backward compat)
    likeCount: total,
    commentCount: opts.commentCount ?? p._count?.comments ?? 0,
    likedByMe: opts.likedByMe ?? false,
    reactions: opts.reactions ?? emptyReactionCounts(),
    myReaction: opts.myReaction ?? null,
    authorFollowedByMe: opts.authorFollowedByMe ?? false,
  }
}

/** Per-kind reaction counts for a page of posts (one groupBy query). */
export async function reactionCounts(postIds: string[]): Promise<Map<string, ReactionCounts>> {
  const map = new Map<string, ReactionCounts>()
  if (postIds.length === 0) return map
  const rows = await db.like.groupBy({
    by: ['postId', 'kind'],
    where: { postId: { in: postIds } },
    _count: { _all: true },
  })
  for (const row of rows) {
    const counts = map.get(row.postId) ?? emptyReactionCounts()
    if (REACTION_KINDS.includes(row.kind as ReactionKind)) {
      counts[row.kind as ReactionKind] = row._count._all
    } else {
      counts.like = row._count._all
    }
    map.set(row.postId, counts)
  }
  return map
}

/** Batch my-reaction lookup for a page of posts: postId -> my kind. */
export async function myReactionMap(userId: string, postIds: string[]): Promise<Map<string, ReactionKind>> {
  const map = new Map<string, ReactionKind>()
  if (postIds.length === 0) return map
  const rows = await db.like.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true, kind: true },
  })
  for (const r of rows) {
    map.set(r.postId, (r.kind as ReactionKind) || 'like')
  }
  return map
}

/** Batch likedByMe lookup for a page of posts. */
export async function likedByMeSet(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set()
  const rows = await db.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
  return new Set(rows.map((r) => r.postId))
}

// ------------------------- comments -------------------------

export type CommentDTO = { id: string; content: string; createdAt: string; author: MiniUser }

export function commentDto(c: Comment & { author: User }): CommentDTO {
  return {
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    author: miniUser(c.author),
  }
}

// ------------------------- gifts -------------------------

export type GiftDTO = {
  id: string
  giftKey: string
  gift: { key: string; name: string; price: number; rarity: string; mood: string; xpReward: number }
  note: string
  coins: number
  contextType: string
  createdAt: string
  sender: MiniUser
  recipient: MiniUser
}

export function giftDto(
  g: Gift & { sender: User; recipient: User; catalog?: GiftCatalog | null },
  catalog?: GiftCatalog | null
): GiftDTO {
  const cat = catalog ?? g.catalog ?? null
  return {
    id: g.id,
    giftKey: g.giftKey,
    gift: {
      key: g.giftKey,
      name: cat?.name ?? g.giftKey,
      price: cat?.price ?? g.coins,
      rarity: cat?.rarity ?? 'common',
      mood: cat?.mood ?? 'happy',
      xpReward: cat?.xpReward ?? 0,
    },
    note: g.note,
    coins: g.coins,
    contextType: g.contextType,
    createdAt: g.createdAt.toISOString(),
    sender: miniUser(g.sender),
    recipient: miniUser(g.recipient),
  }
}

// ------------------------- notifications -------------------------

export type NotificationDTO = {
  id: string
  kind: string
  title: string
  body: string
  data: unknown
  read: boolean
  createdAt: string
}

export function notificationDto(n: Notification): NotificationDTO {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    data: safeParseJson(n.data),
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }
}
