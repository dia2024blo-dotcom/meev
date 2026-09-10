// MEEV realtime service — DM + server channel chat relays.
// dm:send / server:send persist via /api/internal/messages, then broadcast the
// returned MessageDTO; failures bounce msg:error to the sender only.
// Also tracks which users have joined which dm rooms (best-effort partner
// lookup for the user:<partnerId> notification ping + XO games).

import type { Server, Socket } from 'socket.io'
import {
  RATE_DM_SERVER_SEND_MS,
  RATE_TYPING_MS,
} from './config'
import { persistMessage, verifyAccess } from './internal'
import { miniOr } from './presence'
import { RateLimiter, log, sanitizeChatContent } from './util'
import type { MiniUser } from './types'

const sendLimiter = new RateLimiter() // per socket (dm/server sends)
const typingLimiter = new RateLimiter() // per user + room

/** dm conversationId → userIds ever seen joining it (survives leaves). */
const convMembers = new Map<string, Set<string>>()

// ------------------------- v13 security pass: room join authorization -------------------------
// Any authenticated socket used to be able to join ANY dm:/server: room by
// id and silently LISTEN. Joins are now verified against the monolith
// (participant / member / not blocked) before socket.join. Positive results
// are cached for 60s to keep reconnects cheap; failures are never cached.
const ROOM_ACCESS_TTL_MS = 60_000
const roomAccess = new Map<string, number>() // key → expiry of an ALLOW verdict

function roomAccessAllowed(userId: string, scope: 'dm' | 'server', roomKey: string): Promise<boolean> {
  const key = `${userId}|${scope}|${roomKey}`
  const cached = roomAccess.get(key)
  if (cached !== undefined && cached > Date.now()) return Promise.resolve(true)
  roomAccess.delete(key)
  return verifyAccess(
    scope === 'dm' ? { userId, scope, conversationId: roomKey } : { userId, scope, channelId: roomKey },
  ).then((allowed) => {
    if (allowed) roomAccess.set(key, Date.now() + ROOM_ACCESS_TTL_MS)
    return allowed
  })
}

// opportunistic cleanup so the cache can never grow unbounded
setInterval(() => {
  const now = Date.now()
  for (const [k, exp] of roomAccess) {
    if (exp <= now) roomAccess.delete(k)
  }
}, 5 * 60_000).unref()

const KINDS = new Set(['text', 'sticker', 'gift', 'system', 'poll', 'voice', 'game'])

/** Other known member of a dm conversation (best-effort — null until seen). */
export function partnerIn(conversationId: string, exceptUserId: string): string | null {
  const members = convMembers.get(conversationId)
  if (!members) return null
  for (const m of members) {
    if (m !== exceptUserId) return m
  }
  return null
}

function rememberMember(conversationId: string, userId: string): void {
  let members = convMembers.get(conversationId)
  if (!members) {
    members = new Set()
    convMembers.set(conversationId, members)
  }
  members.add(userId)
}

function validRoomKey(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 128 ? v : null
}

function pickKind(v: unknown): string {
  return typeof v === 'string' && KINDS.has(v) ? v : 'text'
}

function pickAttachment(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 500 ? v : null
}

function pickMeta(v: unknown): unknown {
  return v !== null && typeof v === 'object' ? v : null
}

// ------------------------- DM -------------------------

export async function handleDmJoin(socket: Socket, userId: string, payload: any): Promise<void> {
  const conversationId = validRoomKey(payload?.conversationId)
  if (!conversationId) return
  // v13: verify this user is actually a participant (and not blocked)
  // before letting the socket subscribe to the conversation's broadcasts.
  const allowed = await roomAccessAllowed(userId, 'dm', conversationId)
  if (!allowed) {
    log(`dm:join denied — user ${userId} is not a participant of ${conversationId}`)
    return
  }
  socket.join(`dm:${conversationId}`)
  rememberMember(conversationId, userId)
}

export function handleDmLeave(socket: Socket, payload: any): void {
  const conversationId = validRoomKey(payload?.conversationId)
  if (!conversationId) return
  socket.leave(`dm:${conversationId}`)
}

export async function handleDmSend(
  io: Server,
  socket: Socket,
  user: MiniUser,
  payload: any,
): Promise<void> {
  const conversationId = validRoomKey(payload?.conversationId)
  if (!conversationId) return
  if (!sendLimiter.allow(`send:${socket.id}`, RATE_DM_SERVER_SEND_MS)) {
    socket.emit('msg:error', { conversationId, error: 'You are sending messages too quickly' })
    return
  }
  const content = sanitizeChatContent(payload?.content)
  if (!content) {
    socket.emit('msg:error', { conversationId, error: 'Message is empty' })
    return
  }
  rememberMember(conversationId, user.id)

  const res = await persistMessage({
    scope: 'dm',
    conversationId,
    authorId: user.id,
    content,
    kind: pickKind(payload?.kind),
    attachmentUrl: pickAttachment(payload?.attachmentUrl),
    meta: pickMeta(payload?.meta),
  })

  const message = res.data?.message
  if (res.ok && message) {
    io.to(`dm:${conversationId}`).emit('dm:new', { message, conversationId })
    // notification ping for the partner (if we've seen them in this conversation)
    const partnerId = partnerIn(conversationId, user.id)
    if (partnerId) {
      io.to(`user:${partnerId}`).emit('dm:new', { message, conversationId })
    }
    return
  }

  const error =
    res.status === 403 ? 'You can no longer message this user' :
    res.status === 404 ? 'Conversation not found' :
    res.status === 429 ? 'You are sending messages too quickly' :
    typeof res.data?.error === 'string' ? res.data.error :
    'Message failed to send'
  socket.emit('msg:error', { conversationId, error })
}

export function handleDmTyping(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const conversationId = validRoomKey(payload?.conversationId)
  if (!conversationId) return
  if (!typingLimiter.allow(`dmtype:${user.id}:${conversationId}`, RATE_TYPING_MS)) return
  socket.to(`dm:${conversationId}`).emit('dm:typing', {
    conversationId,
    user: miniOr(user),
  })
}

// ------------------------- server channels -------------------------

export async function handleServerJoin(socket: Socket, userId: string, payload: any): Promise<void> {
  const channelId = validRoomKey(payload?.channelId)
  if (!channelId) return
  // v13: verify server membership before subscribing to channel broadcasts.
  const allowed = await roomAccessAllowed(userId, 'server', channelId)
  if (!allowed) {
    log(`server:join denied — user ${userId} is not a member of the server owning ${channelId}`)
    return
  }
  socket.join(`server:${channelId}`)
}

export function handleServerLeave(socket: Socket, payload: any): void {
  const channelId = validRoomKey(payload?.channelId)
  if (!channelId) return
  socket.leave(`server:${channelId}`)
}

export async function handleServerSend(
  io: Server,
  socket: Socket,
  user: MiniUser,
  payload: any,
): Promise<void> {
  const channelId = validRoomKey(payload?.channelId)
  if (!channelId) return
  if (!sendLimiter.allow(`send:${socket.id}`, RATE_DM_SERVER_SEND_MS)) {
    socket.emit('msg:error', { channelId, error: 'You are sending messages too quickly' })
    return
  }
  const content = sanitizeChatContent(payload?.content)
  if (!content) {
    socket.emit('msg:error', { channelId, error: 'Message is empty' })
    return
  }

  const res = await persistMessage({
    scope: 'server',
    channelId,
    authorId: user.id,
    content,
    kind: pickKind(payload?.kind),
    attachmentUrl: pickAttachment(payload?.attachmentUrl),
    meta: pickMeta(payload?.meta),
  })

  const message = res.data?.message
  if (res.ok && message) {
    io.to(`server:${channelId}`).emit('server:new', { message, channelId })
    return
  }

  const error =
    res.status === 403 ? 'You are not a member of this server' :
    res.status === 404 ? 'Channel not found' :
    res.status === 429 ? 'You are sending messages too quickly' :
    typeof res.data?.error === 'string' ? res.data.error :
    'Message failed to send'
  socket.emit('msg:error', { channelId, error })
}

export function handleServerTyping(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const channelId = validRoomKey(payload?.channelId)
  if (!channelId) return
  if (!typingLimiter.allow(`srvtype:${user.id}:${channelId}`, RATE_TYPING_MS)) return
  socket.to(`server:${channelId}`).emit('server:typing', {
    channelId,
    user: miniOr(user),
  })
}
