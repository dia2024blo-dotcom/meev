// MEEV realtime service — Omegle-style matchmaking with AI-stranger fallback.
// Queue is user-level (mode text|video, optional interests). When a compatible
// partner is waiting, both are paired into room `match:<id>`. If still alone
// after 10s the user is auto-paired with the virtual bot (Stranger Cat).
// AI matches keep a per-match history (cap 20) fed to /api/internal/ai-reply;
// bot replies arrive after a realistic 1–3.5s delay with a typing indicator.

import type { Server, Socket } from 'socket.io'
import {
  AI_FALLBACK_REPLIES,
  AI_HISTORY_CAP,
  AI_REPLY_DELAY_MAX_MS,
  AI_REPLY_DELAY_MIN_MS,
  BOT_MINI,
  MATCH_AI_AFTER_MS,
  RATE_MATCH_SEND_MS,
} from './config'
import { aiReply, reportMatch, type AiHistoryEntry } from './internal'
import { getMini, miniOr } from './presence'
import {
  RateLimiter,
  log,
  logErr,
  nowIso,
  randId,
  sanitizeMatchContent,
} from './util'
import type { MatchMessage, MiniUser } from './types'

type MatchMode = 'text' | 'video'

interface QueueEntry {
  userId: string
  mode: MatchMode
  interests: string[]
  enqueuedAt: number
  timer: ReturnType<typeof setTimeout> | null
}

interface MatchInfo {
  id: string
  mode: MatchMode
  interests: string[]
  a: string // human participant
  b: string // other human, or 'meevbot' for AI matches
  isAI: boolean
  startedAt: number
  history: AiHistoryEntry[]
}

const queue: QueueEntry[] = []
const matches = new Map<string, MatchInfo>()
const activeMatch = new Map<string, string>() // userId → matchId
const sendLimiter = new RateLimiter()

// ------------------------- helpers -------------------------

function emitToUser(io: Server, userId: string, event: string, payload: unknown): void {
  io.to(`user:${userId}`).emit(event, payload)
}

function partnerIdOf(match: MatchInfo, userId: string): string {
  return match.a === userId ? match.b : match.a
}

function createMatch(
  io: Server,
  a: string,
  b: string,
  mode: MatchMode,
  interests: string[],
  isAI: boolean,
): MatchInfo {
  const match: MatchInfo = {
    id: randId('match'),
    mode,
    interests,
    a,
    b,
    isAI,
    startedAt: Date.now(),
    history: [],
  }
  matches.set(match.id, match)
  activeMatch.set(a, match.id)
  if (!isAI) activeMatch.set(b, match.id)
  // join every live socket of each participant to the match room
  io.in(`user:${a}`).socketsJoin(`match:${match.id}`)
  if (!isAI) io.in(`user:${b}`).socketsJoin(`match:${match.id}`)
  return match
}

function destroyMatch(io: Server, matchId: string): MatchInfo | null {
  const match = matches.get(matchId)
  if (!match) return null
  io.in(`match:${matchId}`).socketsLeave(`match:${matchId}`)
  matches.delete(matchId)
  activeMatch.delete(match.a)
  activeMatch.delete(match.b)
  return match
}

function removeFromQueue(userId: string): QueueEntry | null {
  const idx = queue.findIndex((e) => e.userId === userId)
  if (idx === -1) return null
  const [entry] = queue.splice(idx, 1)
  if (entry.timer) clearTimeout(entry.timer)
  return entry
}

function trimHistory(match: MatchInfo): void {
  while (match.history.length > AI_HISTORY_CAP) match.history.shift()
}

function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i): i is string => typeof i === 'string')
    .map((i) => i.toLowerCase().trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10)
}

/** End any active match for a user (treat as skip, no requeue). */
function autoLeaveCurrentMatch(io: Server, userId: string): void {
  const matchId = activeMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  destroyMatch(io, matchId)
  if (match && !match.isAI) {
    const partner = partnerIdOf(match, userId)
    if (partner !== userId) {
      emitToUser(io, partner, 'match:partner-left', { matchId, reason: 'skipped' })
    }
  }
}

// ------------------------- match:queue -------------------------

export function handleQueue(io: Server, user: MiniUser, payload: any): void {
  const mode: MatchMode = payload?.mode === 'video' ? 'video' : 'text'
  const interests = normalizeInterests(payload?.interests)

  // a fresh queue request supersedes any current match/queue state
  autoLeaveCurrentMatch(io, user.id)
  removeFromQueue(user.id)

  const candidates = queue.filter((e) => e.userId !== user.id && e.mode === mode)
  let partner: QueueEntry | null = null
  if (candidates.length > 0) {
    partner =
      (interests.length > 0
        ? candidates.find((e) => e.interests.some((i) => interests.includes(i)))
        : undefined) ?? candidates[0]
  }

  if (partner) {
    queue.splice(queue.indexOf(partner), 1)
    if (partner.timer) clearTimeout(partner.timer)
    const match = createMatch(
      io,
      user.id,
      partner.userId,
      mode,
      Array.from(new Set([...interests, ...partner.interests])),
      false,
    )
    emitToUser(io, user.id, 'match:found', {
      matchId: match.id,
      partner: miniOr(partnerMiniFallback(partner.userId)),
      mode,
      isAI: false,
    })
    emitToUser(io, partner.userId, 'match:found', {
      matchId: match.id,
      partner: miniOr(user),
      mode,
      isAI: false,
    })
    log(`match ${match.id}: ${user.username} ↔ ${partner.userId} (${mode})`)
    return
  }

  // nobody compatible is waiting → queue up and arm the AI fallback timer
  const entry: QueueEntry = {
    userId: user.id,
    mode,
    interests,
    enqueuedAt: Date.now(),
    timer: null,
  }
  entry.timer = setTimeout(() => {
    try {
      maybePairWithBot(io, entry)
    } catch (err) {
      logErr('AI fallback timer', err)
    }
  }, MATCH_AI_AFTER_MS)
  queue.push(entry)
  emitToUser(io, user.id, 'match:waiting', {
    queueSize: queue.filter((e) => e.userId !== user.id).length,
  })
  log(`${user.username} queued for a ${mode} match (queue: ${queue.length})`)
}

function partnerMiniFallback(userId: string): MiniUser {
  return (
    getMini(userId) ?? {
      id: userId,
      username: userId,
      displayName: userId,
      avatarSeed: userId,
      level: 1,
      presence: 'online',
      nameColor: '',
      isBot: false,
    }
  )
}

function maybePairWithBot(io: Server, entry: QueueEntry): void {
  if (!queue.includes(entry)) return // left the queue meanwhile
  if (activeMatch.has(entry.userId)) return // matched meanwhile
  queue.splice(queue.indexOf(entry), 1)
  const match = createMatch(io, entry.userId, BOT_MINI.id, entry.mode, entry.interests, true)
  emitToUser(io, entry.userId, 'match:found', {
    matchId: match.id,
    partner: BOT_MINI,
    mode: entry.mode,
    isAI: true,
  })
  log(`match ${match.id}: ${entry.userId} ↔ Stranger Cat (AI fallback, ${entry.mode})`)
}

// ------------------------- match:send -------------------------

export async function handleSend(
  io: Server,
  socket: Socket,
  user: MiniUser,
  payload: any,
): Promise<void> {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || (match.a !== user.id && match.b !== user.id)) {
    socket.emit('msg:error', { matchId, error: 'This match is no longer active' })
    return
  }
  // contract: max 1 msg / 500ms per user — drop silently
  if (!sendLimiter.allow(`match:${user.id}`, RATE_MATCH_SEND_MS)) return

  const content = sanitizeMatchContent(payload?.content)
  if (!content) {
    socket.emit('msg:error', { matchId, error: 'Message is empty' })
    return
  }

  if (match.isAI) {
    match.history.push({ role: 'user', content })
    trimHistory(match)
    // typing indicator, then a realistically-delayed bot reply
    io.to(`match:${matchId}`).emit('match:typing', { matchId, user: BOT_MINI })
    const delay = AI_REPLY_DELAY_MIN_MS + Math.random() * (AI_REPLY_DELAY_MAX_MS - AI_REPLY_DELAY_MIN_MS)
    setTimeout(() => {
      void deliverAiReply(io, matchId, user.id)
    }, delay)
    return
  }

  const message: MatchMessage = {
    id: randId('m'),
    author: miniOr(user),
    content,
    kind: 'text',
    createdAt: nowIso(),
  }
  io.to(`match:${matchId}`).emit('match:new', { matchId, message })
}

async function deliverAiReply(io: Server, matchId: string, userId: string): Promise<void> {
  try {
    const match = matches.get(matchId)
    if (!match || !match.isAI || match.a !== userId) return // match ended during the delay

    let reply = ''
    try {
      const res = await aiReply(userId, match.history)
      const raw = res.data?.reply
      if (res.ok && typeof raw === 'string') reply = sanitizeMatchContent(raw)
    } catch {
      // aiReply itself never throws, but belt & braces
    }
    if (!reply) {
      reply = AI_FALLBACK_REPLIES[Math.floor(Math.random() * AI_FALLBACK_REPLIES.length)]
    }

    const still = matches.get(matchId)
    if (!still || !still.isAI || still.a !== userId) return // ended while fetching
    still.history.push({ role: 'stranger', content: reply })
    trimHistory(still)

    const message: MatchMessage = {
      id: randId('m'),
      author: BOT_MINI,
      content: reply,
      kind: 'text',
      createdAt: nowIso(),
    }
    io.to(`match:${matchId}`).emit('match:new', { matchId, message })
  } catch (err) {
    logErr('AI reply delivery', err)
  }
}

// ------------------------- match:typing -------------------------

export function handleTyping(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || match.isAI) return // AI typing is server-driven
  if (match.a !== user.id && match.b !== user.id) return
  socket.to(`match:${matchId}`).emit('match:typing', { matchId, user: miniOr(user) })
}

// ------------------------- v8: match:effect -------------------------
// Live-room emoji effects (TikTok-style floating reactions). Broadcast to
// the partner (the sender animates locally). Rate-limited 1/350ms so a
// mashed button can't flood the room; emoji whitelisted to a fixed set.

const LIVE_EFFECTS = ['❤️', '🔥', '✨', '🎉', '👏', '😂', '😍', '💀', '🥶', '⚡']
const effectLimiter = new RateLimiter()

export function handleEffect(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  const emoji = typeof payload?.emoji === 'string' ? payload.emoji : ''
  if (!matchId || !LIVE_EFFECTS.includes(emoji)) return
  const match = matches.get(matchId)
  if (!match) return
  if (match.a !== user.id && match.b !== user.id) return
  if (!effectLimiter.allow(`fx:${user.id}`, 350)) return
  socket.to(`match:${matchId}`).emit('match:effect', { matchId, emoji, user: miniOr(user) })
}

// ------------------------- match:skip -------------------------

export function handleSkip(io: Server, user: MiniUser, payload: any): void {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || (match.a !== user.id && match.b !== user.id)) return

  const isAI = match.isAI
  const partner = partnerIdOf(match, user.id)
  const mode = match.mode
  const interests = match.interests

  destroyMatch(io, matchId)
  if (!isAI && partner !== user.id) {
    emitToUser(io, partner, 'match:partner-left', { matchId, reason: 'skipped' })
  }
  // contract requires match:ended to the skipper for AI matches; we also send
  // it for human matches so the local chat view closes cleanly
  emitToUser(io, user.id, 'match:ended', { matchId, reason: 'skipped' })

  if (payload?.requeue === true) {
    handleQueue(io, user, { mode, interests })
  }
}

// ------------------------- match:end -------------------------

export function handleEnd(io: Server, user: MiniUser, payload: any): void {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || (match.a !== user.id && match.b !== user.id)) return

  const isAI = match.isAI
  const partner = partnerIdOf(match, user.id)
  const startedAt = match.startedAt

  destroyMatch(io, matchId)
  if (!isAI && partner !== user.id) {
    emitToUser(io, partner, 'match:partner-left', { matchId, reason: 'ended' })
  }
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  emitToUser(io, user.id, 'match:summary', { matchId, seconds, isAI })
  log(`match ${matchId} ended by ${user.username} after ${seconds}s${isAI ? ' (AI)' : ''}`)
}

// ------------------------- match:report -------------------------

export function handleReport(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
  if (!matchId) return
  const match = matches.get(matchId)
  if (!match || (match.a !== user.id && match.b !== user.id)) {
    socket.emit('msg:error', { matchId, error: 'Match not found' })
    return
  }
  const reason =
    typeof payload?.reason === 'string' && payload.reason.trim()
      ? payload.reason.trim().slice(0, 200)
      : 'other'
  const targetUserId = partnerIdOf(match, user.id)
  // fire-and-forget: the moderation endpoint is parallel work, UX never blocks
  reportMatch(user.id, reason, targetUserId)
  socket.emit('match:report:ok', { matchId, ok: true })
  log(`match ${matchId} reported by ${user.username} (${reason})`)
}

// ------------------------- disconnect cleanup -------------------------

/** Called when a user's last socket goes offline. */
export function onUserOffline(io: Server, userId: string): void {
  removeFromQueue(userId)
  const matchId = activeMatch.get(userId)
  if (!matchId) return
  const match = matches.get(matchId)
  destroyMatch(io, matchId)
  if (match && !match.isAI) {
    const partner = partnerIdOf(match, userId)
    if (partner !== userId) {
      emitToUser(io, partner, 'match:partner-left', { matchId, reason: 'ended' })
    }
  }
  log(`user ${userId} went offline — cleaned up matchmaking state`)
}

/** Introspection for /health & logs. */
export function stats(): { queued: number; activeMatches: number; aiMatches: number } {
  let aiMatches = 0
  for (const m of matches.values()) if (m.isAI) aiMatches++
  return { queued: queue.length, activeMatches: matches.size, aiMatches }
}
