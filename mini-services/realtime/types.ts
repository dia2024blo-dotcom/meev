// MEEV realtime service — shared types (subset of the API contract DTOs).

/** Contract MiniUser DTO. */
export interface MiniUser {
  id: string
  username: string
  displayName: string
  avatarSeed: string
  level: number
  presence: string
  nameColor: string
  isBot: boolean
}

/** Loosely-typed view of the MessageDTO persisted by /api/internal/messages. */
export interface RelayMessage {
  id: string
  scope?: string
  conversationId?: string | null
  channelId?: string | null
  author?: MiniUser
  content?: string
  kind?: string
  attachmentUrl?: string | null
  meta?: unknown
  createdAt?: string
  [key: string]: unknown
}

/** Messages relayed inside matches (not persisted). */
export interface MatchMessage {
  id: string
  author: MiniUser
  content: string
  kind: 'text'
  createdAt: string
}

/** Generic result of an internal HTTP call to the Next.js monolith. */
export interface InternalResult {
  ok: boolean
  status: number
  data: any
}
