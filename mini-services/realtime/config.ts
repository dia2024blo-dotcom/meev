// MEEV realtime service — configuration & shared constants.
// Secrets mirror /home/z/my-project/.env (env wins when present).
import type { MiniUser } from './types'
export const PORT = 3003 // hardcoded — Caddy forwards /?XTransformPort=3003 here
export const JWT_SECRET =
  process.env.MEEV_JWT_SECRET ?? 'm33v-super-secret-jwt-key-2027-change-in-production'
export const SERVICE_KEY =
  process.env.MEEV_SERVICE_KEY ?? 'm33v-internal-service-key-2027'
/** Base URL of the Next.js modular monolith (already running in the sandbox). */
export const NEXT_BASE = 'http://localhost:3000'
/** The virtual stranger every lonely queue-waiter gets paired with after 10s. */
export const BOT_MINI: MiniUser = {
  id: 'meevbot',
  username: 'meevbot',
  displayName: 'Stranger Cat',
  avatarSeed: 'honey|gold|1',
  level: 42,
  presence: 'online',
  nameColor: '#f59e0b',
  isBot: true,
}
/** Playful canned replies when /api/internal/ai-reply is unreachable/fails — UX never breaks. */
export const AI_FALLBACK_REPLIES: string[] = [
  '😹 I zoned out for a second — say that again?',
  '🐈 my whiskers glitched — repeat that real quick?',
  'purr… signal lost in the catnip cloud. what were you saying?',
  '😹 the cat ate my reply! try once more?',
  'mrrow? I chased a laser dot and lost my thought — go on?',
  '🐱 quick catnap attack — you were saying?',
]
// ----- rate limits -----
/** dm:send / server:send — 1 message per 400ms per socket (task spec). */
export const RATE_DM_SERVER_SEND_MS = 400
/** match:send — max 1 msg / 500ms per user (binding contract). */
export const RATE_MATCH_SEND_MS = 500
/** typing indicator throttle — 2s per user/conversation. */
export const RATE_TYPING_MS = 2000
// ----- matchmaking -----
/** Alone in queue this long → pair with the AI stranger. */
export const MATCH_AI_AFTER_MS = 10_000
/** Per-match AI conversation history cap (entries). */
export const AI_HISTORY_CAP = 20
/** Bot reply delay window for realism. */
export const AI_REPLY_DELAY_MIN_MS = 1000
export const AI_REPLY_DELAY_MAX_MS = 3500
// ----- caps -----
export const ONLINE_LIST_CAP = 200
export const MESSAGE_MAX_CHARS = 2000 // sanitize.ts "message" field cap
export const MATCH_MESSAGE_MAX_CHARS = 1000 // matchmaking content clamp
export const HTTP_BODY_MAX_BYTES = 1_000_000
