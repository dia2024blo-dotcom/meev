// MEEV — Unified message pipeline used by /api/internal/messages,
// server join (system messages) and gift sending (gift messages).
// Validates membership + blocks, sanitizes, processes slash commands
// (incl. the DB-aware /rps duel + partner-aware big reactions),
// persists, updates DM lastMessageAt, feeds the v3 streak engine
// (milestone system messages + notifications), applies the bilingual
// profanity filter and a cheap duplicate anti-spam guard.

import type { DMConversation } from '@prisma/client'
import { db } from '@/lib/db'
import { newId } from './ids'
import { sanitizeText, looksSuspicious } from './sanitize'
import { processCommand, parseCommand } from './commands'
import { STREAK_THEME_STEP } from './constants'
import { messageDto, type MessageDTO } from './dto'
import { filterProfanity } from './profanity'
import { broadcast, notifyUser } from './realtime'
import { assertNotSuspended, assertNotMuted, enforceTextRules, SanctionError } from './moderation'

const KIND_WHITELIST = new Set(['text', 'sticker', 'gift', 'system', 'poll', 'voice', 'game', 'story_react', 'post_share'])
const META_KINDS = new Set(['poll', 'game', 'gift', 'sticker', 'story_react', 'post_share'])
const REACTION_COMMANDS = new Set(['hug', 'kiss', 'pat', 'boop'])
/** User-typed text kinds that go through the profanity filter. */
const PROFANITY_KINDS = new Set(['text', 'poll', 'story_react'])
const DUPLICATE_WINDOW_MS = 10_000

// v13 security pass: message attachments (voice notes etc.) must be same-origin
// server paths — a raw API caller could otherwise attach arbitrary external
// URLs (mixed content / 3rd-party beacons) that clients then load blindly.
const ATTACHMENT_URL_RE = /^\/(uploads|meev-media)\/[A-Za-z0-9_-]+\.(wav|webp|jpe?g|png|gif|mp3|ogg)$/

/** Normalize an attachment URL: same-origin media path or nothing. */
function normalizeAttachmentUrl(v: string | null | undefined): string | null {
  if (typeof v !== 'string' || v === '') return null
  const url = v.split('?')[0]
  return ATTACHMENT_URL_RE.test(url) ? url : null
}

// ------------------------- v3 streak helpers -------------------------

/** UTC day index (days since epoch — pure integer math, no DST traps). */
export function utcDay(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000)
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)])
}

export class MessageError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type CreateMessageParams = {
  scope: 'dm' | 'server'
  conversationId?: string | null
  channelId?: string | null
  authorId: string
  content: string
  kind?: string
  attachmentUrl?: string | null
  meta?: Record<string, unknown> | null
  /** false for bot/system-generated messages (skips slash commands + XP) */
  processCommands?: boolean
}

// ------------------------- RPS duel helpers -------------------------

const MOVE_EMOJI: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' }

type RpsState = {
  challengerId: string
  challengerMove: string
  opponentMove?: string
  status: 'awaiting' | 'done'
  result?: 'win' | 'lose' | 'draw'
  winnerId?: string
}

function parseJsonMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function asRpsState(v: unknown): RpsState | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.challengerId !== 'string' || typeof r.challengerMove !== 'string') return null
  if (r.challengerMove !== 'rock' && r.challengerMove !== 'paper' && r.challengerMove !== 'scissors') return null
  return {
    challengerId: r.challengerId,
    challengerMove: r.challengerMove,
    opponentMove: typeof r.opponentMove === 'string' ? r.opponentMove : undefined,
    status: r.status === 'done' ? 'done' : 'awaiting',
    result: r.result === 'win' || r.result === 'lose' || r.result === 'draw' ? r.result : undefined,
    winnerId: typeof r.winnerId === 'string' ? r.winnerId : undefined,
  }
}

/** True when move `a` beats move `b` (rock > scissors > paper > rock). */
function beats(a: string, b: string): boolean {
  return (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  )
}

/** Duel outcome from the CHALLENGER's perspective. */
function duelOutcome(challengerMove: string, opponentMove: string): 'win' | 'lose' | 'draw' {
  if (challengerMove === opponentMove) return 'draw'
  return beats(challengerMove, opponentMove) ? 'win' : 'lose'
}

/**
 * Create a new message. Slash commands transform the message (kind/content/
 * meta) before persistence; the /rps duel additionally updates the awaiting
 * challenge message and queues winner XP (run after the response message is
 * persisted so the dm:new broadcast + refetch always sees consistent state).
 * Throws MessageError with proper status on validation failure.
 */
export async function createMessage(params: CreateMessageParams): Promise<MessageDTO> {
  const { scope, authorId } = params
  if (scope !== 'dm' && scope !== 'server') throw new MessageError(400, 'scope must be "dm" or "server"')

  const author = await db.user.findUnique({ where: { id: authorId } })
  if (!author) throw new MessageError(404, 'Author not found')

  // v4 community rules: suspension/mute gates + the automated rule engine
  // (self-harm > insult > spam, each with a published punishment ladder).
  if (params.processCommands !== false && !author.isBot) {
    try {
      assertNotSuspended(author)
      assertNotMuted(author)
    } catch (e) {
      if (e instanceof SanctionError) throw new MessageError(e.status, e.message)
      throw e
    }
  }

  let conversationId: string | null = null
  let channelId: string | null = null
  let partnerUserId: string | null = null // other DM member (for /hug etc + duel names)
  let dmConv: DMConversation | null = null // kept for the streak engine

  if (scope === 'dm') {
    const cid = params.conversationId || null
    if (!cid) throw new MessageError(400, 'conversationId is required for dm messages')
    const conv = await db.dMConversation.findUnique({ where: { id: cid } })
    if (!conv) throw new MessageError(404, 'Conversation not found')
    if (conv.userAId !== authorId && conv.userBId !== authorId) {
      throw new MessageError(403, 'You are not a participant in this conversation')
    }
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: conv.userAId, blockedId: conv.userBId },
          { blockerId: conv.userBId, blockedId: conv.userAId },
        ],
      },
    })
    if (blocked) throw new MessageError(403, 'You can no longer message this user')
    conversationId = conv.id
    dmConv = conv
    partnerUserId = conv.userAId === authorId ? conv.userBId : conv.userAId
  } else {
    const chId = params.channelId || null
    if (!chId) throw new MessageError(400, 'channelId is required for server messages')
    const channel = await db.channel.findUnique({ where: { id: chId } })
    if (!channel) throw new MessageError(404, 'Channel not found')
    const membership = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: channel.serverId, userId: authorId } },
    })
    if (!membership) throw new MessageError(403, 'You are not a member of this server')
    channelId = channel.id
  }

  // kind whitelist
  let kind = typeof params.kind === 'string' && KIND_WHITELIST.has(params.kind) ? params.kind : 'text'

  // sanitize content
  let content = sanitizeText(params.content, 'message')
  let metaObj: Record<string, unknown> | null =
    params.meta && typeof params.meta === 'object' && !Array.isArray(params.meta)
      ? (params.meta as Record<string, unknown>)
      : null

  // v4 community-rules engine — strikes, mutes, suspensions and bilingual
  // notifications happen inside enforceTextRules; the message is blocked
  // before it ever reaches the DB.
  if (params.processCommands !== false && !author.isBot && PROFANITY_KINDS.has(kind)) {
    const verdict = await enforceTextRules(authorId, params.content)
    if (verdict.blocked) throw new MessageError(400, verdict.message || 'غير مسموح / Not allowed')
  }

  // v3 profanity filter — soft words are masked in place; hard abuse is
  // already blocked (with a strike) by the rules engine above.
  if (params.processCommands !== false && PROFANITY_KINDS.has(kind)) {
    const filtered = filterProfanity(content)
    if (filtered.hard) throw new MessageError(400, 'هذه الرسالة غير مقبولة 🚫')
    if (filtered.masked) content = filtered.text
  }

  // side effect queued by command processing (winner XP etc), run after persistence
  let postPersist: (() => Promise<void>) | null = null

  // slash commands (only user text messages)
  if (params.processCommands !== false && kind === 'text' && content.startsWith('/')) {
    const { name, arg } = parseCommand(content)

    if (name === 'rps') {
      const move = arg.toLowerCase()
      if (move !== 'rock' && move !== 'paper' && move !== 'scissors') {
        kind = 'system'
        content = sanitizeText(
          `⚔️ Usage: /rps rock | paper | scissors — duel your ${scope === 'dm' ? 'partner' : 'friends'}! Winner takes the bragging rights 🏆`,
          'message'
        )
      } else {
        // look for an awaiting challenge from someone else in this thread
        const scopeWhere = conversationId ? { conversationId } : { channelId }
        const recentGames = await db.message.findMany({
          where: { ...scopeWhere, kind: 'game', deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })

        let awaiting: { id: string; rps: RpsState; meta: Record<string, unknown> } | null = null
        let ownAwaiting = false
        for (const m of recentGames) {
          const meta = parseJsonMeta(m.meta)
          if (!meta || meta.game !== 'rps') continue
          const rps = asRpsState(meta.rps)
          if (!rps || rps.status !== 'awaiting') continue
          if (rps.challengerId === authorId) {
            ownAwaiting = true
            continue
          }
          awaiting = { id: m.id, rps, meta }
          break
        }

        if (awaiting) {
          // I'm the opponent → resolve the duel
          const challengerId = awaiting.rps.challengerId
          const challengerMove = awaiting.rps.challengerMove
          const outcome = duelOutcome(challengerMove, move) // challenger's perspective
          const winnerId = outcome === 'win' ? challengerId : outcome === 'lose' ? authorId : undefined

          const challengerName =
            challengerId === authorId
              ? author.displayName
              : ((await db.user.findUnique({ where: { id: challengerId }, select: { displayName: true } }))?.displayName ?? 'Challenger')

          kind = 'system'
          const emojiA = MOVE_EMOJI[challengerMove] ?? '❓'
          const emojiB = MOVE_EMOJI[move] ?? '❓'
          const winnerName = winnerId === challengerId ? challengerName : author.displayName
          content = sanitizeText(
            outcome === 'draw'
              ? `⚔️ RPS: ${challengerName} ${emojiA} vs ${emojiB} ${author.displayName} — Draw! 🤝`
              : `⚔️ RPS: ${challengerName} ${emojiA} vs ${emojiB} ${author.displayName} — ${winnerName} wins! 🏆`,
            'message'
          )

          // update the awaiting challenge message BEFORE the result message
          // is persisted — the dm:new broadcast + client refetch then sees
          // both the resolved card and the result line in one pass.
          const resolved: RpsState = {
            ...awaiting.rps,
            status: 'done',
            opponentMove: move,
            result: outcome,
            winnerId,
          }
          try {
            await db.message.update({
              where: { id: awaiting.id },
              data: { meta: JSON.stringify({ ...awaiting.meta, game: 'rps', rps: resolved }) },
            })
          } catch {
            // duel state update is best-effort — the result message still goes out
          }

          postPersist = async () => {
            // v16: duels give pure glory — XP comes only from interaction hours
          }
        } else if (ownAwaiting) {
          // my own duel is already on the table — avoid spamming new cards
          kind = 'system'
          content = sanitizeText(
            `⚔️ ${author.displayName} already has a duel waiting — the opponent replies with /rps <move>!`,
            'message'
          )
        } else {
          // fresh challenge — challenger move is stored but only revealed client-side once the duel resolves
          kind = 'game'
          content = sanitizeText(`⚔️ ${author.displayName} challenges you to RPS!`, 'message')
          metaObj = {
            game: 'rps',
            rps: { challengerId: authorId, challengerMove: move, status: 'awaiting' },
          }
        }
      }
    } else {
      // sync commands; partner-aware ones need the DM partner's display name
      let partnerName: string | null = null
      if (REACTION_COMMANDS.has(name) && partnerUserId) {
        const partner = await db.user.findUnique({
          where: { id: partnerUserId },
          select: { displayName: true },
        })
        partnerName = partner?.displayName ?? null
      }
      const result = processCommand(content, author.displayName, partnerName)
      kind = result.kind
      content = sanitizeText(result.content, 'message')
      if (result.meta) metaObj = result.meta
    }
  }

  // meta is persisted only for structured kinds
  const meta = META_KINDS.has(kind) && metaObj ? JSON.stringify(metaObj) : null

  // v3 anti-spam: identical DM text from the same author within 10s —
  // one indexed query on (scope, conversationId, createdAt).
  if (scope === 'dm' && conversationId && kind === 'text') {
    const last = await db.message.findFirst({
      where: { conversationId, authorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true },
    })
    if (
      last &&
      last.content === content &&
      Date.now() - last.createdAt.getTime() < DUPLICATE_WINDOW_MS
    ) {
      throw new MessageError(429, 'تمهّل شوي يا بطل 🐾 / Slow down a little')
    }
  }

  const message = await db.message.create({
    data: {
      id: newId(),
      scope,
      conversationId,
      channelId,
      authorId,
      content,
      kind,
      attachmentUrl: normalizeAttachmentUrl(params.attachmentUrl) || null,
      meta,
    },
    include: { author: true },
  })

  if (scope === 'dm' && conversationId) {
    // ---- v6 read receipts: the author has trivially "seen" their own send ----
    const readField = dmConv ? (dmConv.userAId === authorId ? 'aReadAt' : 'bReadAt') : null
    // ---- v3 streak engine (runs with the lastMessageAt write) ----
    // UTC-day logic: same day → unchanged; yesterday → +1; else → reset to 1.
    const today = utcDay(new Date())
    const lastDay = dmConv?.lastStreakDate ? utcDay(dmConv.lastStreakDate) : null
    if (lastDay === today) {
      await db.dMConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), ...(readField ? { [readField]: message.createdAt } : {}) },
      })
    } else {
      const streakDays = lastDay === today - 1 ? (dmConv?.streakDays ?? 0) + 1 : 1
      // a multiple-of-3 milestone newly crossed and never celebrated yet
      const milestone =
        streakDays > 0 &&
        streakDays % STREAK_THEME_STEP === 0 &&
        streakDays > (dmConv?.streakNotified ?? 0)
      await db.dMConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          streakDays,
          lastStreakDate: new Date(),
          ...(readField ? { [readField]: message.createdAt } : {}),
          ...(milestone ? { streakNotified: streakDays } : {}),
        },
      })

      if (milestone) {
        // celebrate: bilingual system message + dm:new push + notifications
        // for BOTH users (best-effort — the streak itself is already saved).
        try {
          const partnerName =
            partnerUserId != null
              ? (await db.user.findUnique({
                  where: { id: partnerUserId },
                  select: { displayName: true },
                }))?.displayName ?? 'your friend'
              : 'your friend'
          const sys = await db.message.create({
            data: {
              id: newId(),
              scope: 'dm',
              conversationId,
              authorId,
              content: sanitizeText(
                `🔥 سلسلة ${toArabicDigits(streakDays)} أيام مع ${partnerName}! فُتحت سمة محادثة جديدة ✨ / 🔥 ${streakDays}-day streak with ${partnerName}! A new chat theme unlocked ✨`,
                'message'
              ),
              kind: 'system',
            },
            include: { author: true },
          })
          await db.dMConversation
            .update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } })
            .catch(() => null)
          const dto = messageDto({ ...sys, reactions: [] })
          await broadcast(`dm:${conversationId}`, 'dm:new', { message: dto, conversationId })
          if (partnerUserId) {
            await broadcast(`user:${partnerUserId}`, 'dm:new', { message: dto, conversationId })
          }
          const title = `🔥 ${toArabicDigits(streakDays)} أيام / ${streakDays}-day streak!`
          const body = `فُتحت سمة محادثة جديدة مع ${partnerName} ✨ / A new chat theme unlocked with ${partnerName} ✨`
          if (partnerUserId) {
            await notifyUser(partnerUserId, 'system', title, body, { conversationId, streakDays }).catch(() => null)
          }
          await notifyUser(authorId, 'system', title, body, { conversationId, streakDays }).catch(() => null)
        } catch {
          // milestone celebration is cosmetic — never fail the message
        }
      }
    }
  }

  // (v16: no XP for messages — levels come only from hours of interaction)

  if (looksSuspicious(params.content)) {
    await db.auditLog
      .create({
        data: { id: newId(), userId: authorId, action: 'suspicious_message', meta: JSON.stringify({ scope, conversationId, channelId }) },
      })
      .catch(() => null)
  }

  // queued command side effects (RPS winner XP) — fire after delivery
  if (postPersist) {
    await postPersist().catch(() => null)
  }

  return messageDto({ ...message, reactions: [] })
}
