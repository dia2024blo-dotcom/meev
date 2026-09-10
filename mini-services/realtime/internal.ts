// MEEV realtime service — HTTP client for the Next.js monolith's internal APIs
// (x-meev-service-key protected). The monolith is parallel work (Task 2-b):
// every call is defensive — failures never throw, they resolve to {ok:false}.

import { NEXT_BASE, SERVICE_KEY } from './config'
import { logErr } from './util'
import type { InternalResult, MiniUser } from './types'

async function postJson(
  path: string,
  body: unknown,
  timeoutMs = 8000,
): Promise<InternalResult> {
  try {
    const res = await fetch(NEXT_BASE + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meev-service-key': SERVICE_KEY,
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      // non-JSON response body
    }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    // network error / timeout / DNS — monolith down or endpoint not built yet
    return { ok: false, status: 0, data: null }
  }
}

// ------------------------- messages -------------------------

export interface PersistMessageBody {
  scope: 'dm' | 'server'
  conversationId?: string
  channelId?: string
  authorId: string
  content: string
  kind?: string
  attachmentUrl?: string | null
  meta?: unknown
}

/** Persist a dm/server message. Awaits the result — used for broadcast-on-success. */
export function persistMessage(body: PersistMessageBody): Promise<InternalResult> {
  return postJson('/api/internal/messages', body, 8000)
}

// ------------------------- AI stranger -------------------------

export interface AiHistoryEntry {
  role: 'user' | 'stranger'
  content: string
}

/** Ask the monolith's LLM for the AI stranger's reply. Long timeout (LLM). */
export function aiReply(userId: string, history: AiHistoryEntry[]): Promise<InternalResult> {
  return postJson('/api/internal/ai-reply', { userId, history }, 30000)
}

// ------------------------- fire-and-forget calls -------------------------

/** Presence changes are pushed best-effort; failures are logged and swallowed. */
export function pushPresence(userId: string, presence: string): void {
  void postJson('/api/internal/presence', { userId, presence }, 6000).then((res) => {
    if (!res.ok) logErr(`internal presence POST failed (${res.status}) for ${userId}`)
  })
}

/** XO game XP awards (game_win 8 / game_play 2) — fire and forget. */
export function awardXp(userId: string, amount: number, reason: string): void {
  void postJson('/api/internal/xp', { userId, amount, reason }, 6000).then((res) => {
    if (!res.ok) logErr(`internal xp POST failed (${res.status}) for ${userId} (${reason})`)
  })
}

/** Match reports → moderation queue — fire and forget. */
export function reportMatch(reporterId: string, reason: string, targetUserId?: string): void {
  void postJson('/api/internal/report', { reporterId, reason, targetUserId }, 6000).then((res) => {
    if (!res.ok) logErr(`internal report POST failed (${res.status}) for ${reporterId}`)
  })
}

// ------------------------- room access (v13 security pass) -------------------------

export interface VerifyAccessBody {
  userId: string
  scope: 'dm' | 'server'
  conversationId?: string
  channelId?: string
}

/**
 * Membership check for socket room joins. FAIL CLOSED: any network/parse
 * failure returns false — if the monolith is down, messages can't be
 * persisted (and therefore can't be broadcast) anyway, so refusing the join
 * is the safe side of the trade.
 */
export function verifyAccess(body: VerifyAccessBody): Promise<boolean> {
  return postJson('/api/internal/verify-access', body, 4000).then(
    (res) => res.ok === true && res.data?.allowed === true,
    () => false,
  )
}

// ------------------------- profile lookup -------------------------

/**
 * Best-effort MiniUser profile enrichment via the PUBLIC
 * `GET /api/users/:username` endpoint (no auth needed). Returns null on any
 * failure — callers must fall back to JWT-derived defaults.
 */
export async function fetchMiniUser(username: string): Promise<MiniUser | null> {
  try {
    const res = await fetch(
      `${NEXT_BASE}/api/users/${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as any
    const u = data?.user
    if (!u || typeof u.id !== 'string') return null
    return {
      id: u.id,
      username: typeof u.username === 'string' ? u.username : username,
      displayName: typeof u.displayName === 'string' ? u.displayName : username,
      avatarSeed: typeof u.avatarSeed === 'string' ? u.avatarSeed : username,
      level: typeof u.level === 'number' ? u.level : 1,
      presence: 'online',
      nameColor: typeof u.nameColor === 'string' ? u.nameColor : '',
      isBot: Boolean(u.isBot),
    }
  } catch {
    return null
  }
}
