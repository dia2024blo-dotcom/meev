# MEEV — Full API & Realtime Contract (v1)

This is the binding contract between the Meev frontend and backend. All request/response shapes are EXACT. Shared libs live in `src/lib/meev/` (constants, ids, sanitize, rate-limit, auth, xp, similarity, serialize). The DB schema is `prisma/schema.prisma` (SQLite, already pushed).

## Conventions

- Auth: `Authorization: Bearer <accessToken>` on protected routes. Refresh cookie `meev_rt` (HttpOnly) rotated by `POST /api/auth/refresh`.
- Errors: `{ "error": "human readable message" }` with proper status codes (400/401/403/404/429/500). NEVER leak internals.
- All list endpoints are paginated `?page=1` (20/page) returning `{items, hasMore}` style where relevant.
- TypeScript strict. Use `db` from `@/lib/db`.

## Shared DTOs

```ts
type MiniUser = { id: string; username: string; displayName: string; avatarSeed: string; level: number; presence: string; nameColor: string; isBot: boolean }
type PublicUser = { id; username; displayName; avatarSeed; bio; city: string|null; interests: string[]; xp; level; coins; presence; nameColor; role; isBot; isGuest; createdAt: string; lastActiveAt: string; privacy?: Record<string,string>; stats?: {followers,following,posts,friends}; badges?: {key,earnedAt}[] }
type MessageDTO = { id; scope: 'dm'|'server'; conversationId: string|null; channelId: string|null; author: MiniUser; content: string; kind: 'text'|'sticker'|'gift'|'system'|'poll'|'voice'|'game'; attachmentUrl: string|null; meta: any|null; createdAt: string; reactions: { emoji: string; users: MiniUser[] }[] }
type PostDTO = { id; content; imageUrl: string|null; kind: 'text'|'image'; createdAt: string; author: MiniUser; likeCount: number; commentCount: number; likedByMe: boolean }
type CommentDTO = { id; content; createdAt: string; author: MiniUser }
type GiftDTO = { id; giftKey; gift: {key,name,price,rarity,mood,xpReward}; note; coins; contextType; createdAt: string; sender: MiniUser; recipient: MiniUser }
type NotificationDTO = { id; kind; title; body; data: any; read: boolean; createdAt: string }
```

`avatarSeed` format: `"<paletteKey>|<gradientKey>|<variantNumber 0-3>"` e.g. `"mochi|sunset|2"`. Empty string → random derive from id.

## AUTH `/api/auth/*`

### POST /api/auth/register
Body: `{ username, email, password, displayName?, interests?: string[] }`
- validate: username (3-24, `[a-z0-9._]`, unique), email unique, password strength via `checkPasswordStrength`, interests ⊆ INTERESTS keys (max 8).
- create user (password scrypt-hashed, `avatarSeed` random from CAT_PALETTE × AVATAR_GRADIENTS × 0-3, coins 500), founder badge, EmailToken purpose=verify (6-digit OTP, 15 min expiry), welcome Notification, session+refresh cookie, XP_REWARDS.register.
- Response 200: `{ user: PublicUser(self), accessToken, expiresIn: 900, devOtp: { code: string, purpose: 'verify', expiresAt } }` — devOtp included because MEEV_SMTP_MODE=demo (simulated SMTP inbox).
- Rate limit: 10/min per IP.

### POST /api/auth/verify-email
Body: `{ email, code }`. Marks `emailVerifiedAt`, awards +15 XP ("email_verified" PointsLog + founder badge if missing), returns `{ user: PublicUser(self) }`.

### POST /api/auth/resend-otp — Body: `{ email, purpose?: 'verify'|'reset'|'twofactor' }` → new EmailToken; Response `{ devOtp: {code,purpose,expiresAt} }` (rate limit 3/min).

### POST /api/auth/login
Body: `{ identifier, password, otp?: string }`
- identifier = email OR username. Brute force: `failedLogins >= 5` → `lockedUntil = now + 15min` → 423 `{error:"Account temporarily locked after too many failed attempts. Try again in X minutes."}`.
- If `twoFactorEnabled` and no valid otp (EmailToken purpose=twofactor, 10 min) → 401 `{ error: '2FA_REQUIRED' }` (frontend then requests otp and retries with otp). On otp request generation: when login password ok but 2FA needed, generate the twofactor EmailToken and include `devOtp` in the 401 response body.
- Success: reset failedLogins, create session + refresh cookie, update `lastActiveAt`, `presence` from request default 'online', daily_login XP if last > 20h, AuditLog 'login' if new device (device not in prior sessions).
- Response: `{ user: PublicUser(self), accessToken, expiresIn: 900 }`.

### POST /api/auth/guest — creates guest account `guest_<rand>` (isGuest, email `guest_<rand>@meev.local`, random password, random seed) → `{ user, accessToken, expiresIn }` + cookie. Rate limit 5/min IP.

### POST /api/auth/refresh — reads meev_rt cookie (no body). Validate via `consumeRefreshToken` → revoke old refresh token, create new one + new session, issue access token. Response `{ user: PublicUser(self), accessToken, expiresIn }`. 401 if invalid.

### POST /api/auth/logout — revoke refresh token + clear cookie. `{ ok: true }`

### GET /api/auth/me — Bearer required → `{ user: PublicUser(self with stats + badges) }` (stats: followers/following/posts/friends counts; badges from UserBadge).

### GET /api/auth/sessions — `{ sessions: [{ id, device, ip, createdAt, lastSeenAt, current: boolean }] }` (current = session created within this refresh chain — mark the one whose lastSeenAt is most recent AND device matches current UA; simpler: current = newest session).

### DELETE /api/auth/sessions/[id] — revoke by id (owner only). `{ ok: true }`

### POST /api/auth/forgot-password — Body `{ email }`. Always `{ ok: true }` (no user enumeration). If user exists: EmailToken purpose=reset (single-use, 15 min). Include `devOtp` when SMTP demo mode.

### POST /api/auth/reset-password — Body `{ email, code, newPassword }`. Validate token single-use, strength, update hash, revoke ALL sessions + refresh tokens for user, AuditLog 'password_reset'. `{ ok: true }`.

### POST /api/auth/2fa — Bearer. Body `{ enabled: boolean }` → toggle twoFactorEnabled. `{ ok, enabled }`.

## USERS `/api/users/*`

### PATCH /api/users/me — Bearer. Body (all optional): `{ displayName?, bio?, city?, interests?, nameColor?, presence? ('online'|'busy'|'dnd'|'offline'), privacy? {location?,interests?,presence? each 'everyone'|'friends'|'nobody'} }`
- Whitelist only these keys (anti mass-assignment). nameColor must be in NAME_COLORS AND level>=1. interests ⊆ INTERESTS (max 8). displayName 1-32.
- Also broadcasts presence change via realtime: POST http://localhost:3003/broadcast {room: 'global', event: 'presence:update', payload: {userId, presence}} with x-meev-service-key.
- Response `{ user: PublicUser(self) }`.

### GET /api/users/[username] — Public (auth optional). Response `{ user: PublicUser(+stats+badges), relationship: { following: boolean, isFollowingMe: boolean, friendship: 'none'|'pending_out'|'pending_in'|'friends'|'blocked_out'|'blocked_in' } }` (relationship only when authenticated).

### GET /api/users/[username]/posts — Public. `{ posts: PostDTO[], hasMore }` (?page=)

### POST /api/users/search — Bearer. Body `{ q?: string, interest?: string, online?: boolean, city?: string, page? }` → `{ users: (PublicUser & { score?: number })[] }`. LIKE search on username/displayName. online filter joins on presence + realtime? presence field only (socket online map is separate; approximate with presence !== 'offline' OR lastActiveAt < 5 min).

### GET /api/users/suggestions — Bearer. `{ users: (PublicUser & { score: number, mutualCount: number, sharedInterests: string[] })[] }` — top 12 using `similarityScore` (excludes self, blocked, already-friends, already-pending). Mutual = accepted FriendRequest between me & their friends. myHours/theirHours: derive from their lastActiveAt hour +2h window (simple heuristic).

### POST /api/users/[id]/follow — Bearer. Creates Follow (idempotent), notification to target `{kind:'follow', title:'<displayName> started following you', data:{userId}}` + realtime push. `{ following: true }`
### DELETE /api/users/[id]/follow — `{ following: false }`

### POST /api/users/[id]/friend-request — Bearer. If reverse pending → accept both → `{ status: 'friends' }` + notification to other. If already pending from me → `{ status:'pending_out' }`. If friends → `{status:'friends'}`. Else create pending + notification + realtime push. Blocked either way → 403.
### POST /api/users/[id]/friend-respond — Bearer. Body `{ accept: boolean }` → accept/decline incoming pending → `{ status: 'friends'|'none' }` + notification.
### POST /api/users/[id]/block — Bearer → Block + auto-decline pending requests + unfollow both → `{ blocked: true }`
### DELETE /api/users/[id]/block → `{ blocked: false }`

### POST /api/users/report — Bearer. Body `{ targetType: 'user'|'message'|'post'|'match', targetUserId?, targetId?, reason (harassment|nsfw|spam|impersonation|other), details? }` → creates Report (moderation queue). `{ ok: true }`

### GET /api/users/[username] minimal variant: the profile endpoint also returns `recentActivity?: [{kind:'post'|'comment'|'gift', at: string}]` — optional nicety, skip if complex.

## POSTS `/api/posts/*`

### GET /api/posts/feed — Bearer. `?page=1&filter=all|following` → `{ posts: PostDTO[], hasMore }` (following = posts from users I follow). Order createdAt desc. Include likeCount, commentCount, likedByMe.
### POST /api/posts — Bearer. Body `{ content (1-4000), imageUrl?: string (must start with '/uploads/' or '/meev-media/') }` → `{ post: PostDTO }`. XP 'post'. Rate limit 10/min.
### DELETE /api/posts/[id] — author only → `{ ok: true }`
### POST /api/posts/[id]/like — Bearer (idempotent) → `{ liked: true, likeCount }` — XP 'like' once per post (Like unique). Realtime notify author if not self: notification kind 'like'.
### DELETE /api/posts/[id]/like → `{ liked: false, likeCount }`
### GET /api/posts/[id]/comments — Public → `{ comments: CommentDTO[] }`
### POST /api/posts/[id]/comments — Bearer `{ content (1-1000) }` → `{ comment: CommentDTO }` XP 'comment' + notification to author kind 'comment'.
### GET /api/posts/trending — Public → `{ posts: PostDTO[] }` top 20 by `(likeCount*2 + commentCount*3)` last 7 days.

## STORIES `/api/stories/*`

### GET /api/stories — Bearer → `{ groups: [{ author: MiniUser, stories: [{ id, kind, content, gradient, imageUrl, createdAt, viewedByMe: boolean }] }], myStories: [...] }` — unexpired stories (expiresAt > now) grouped by author, authors I follow first, then recency. Mark viewed via view endpoint.
### POST /api/stories — Bearer. Body `{ kind:'text'|'image', content? (≤280), gradient? (key from STORY_GRADIENTS), imageUrl? }` expiresAt = now+24h → `{ story }`. XP 'post'.
### POST /api/stories/[id]/view — Bearer → mark StoryView (idempotent) `{ ok: true }`

## DMS `/api/dms/*`

### GET /api/dms — Bearer → `{ conversations: [{ id, partner: MiniUser, lastMessage: { content, kind, authorId, createdAt } | null, updatedAt: string }] }` ordered by lastMessageAt desc. Block check: hide conversations with blocked users.
### POST /api/dms — Bearer. Body `{ targetUserId }` (or `?targetUsername=`) → find-or-create DMConversation (userAId = smaller id for uniqueness) → `{ conversationId }`. 403 if blocked either way.
### GET /api/dms/[id]/messages — Bearer. `?before=<iso>&limit=50` → `{ messages: MessageDTO[], partner: MiniUser, hasMore }`. Validate membership (userA/userB). Reactions included.
### (Messages are SENT via the realtime socket which calls POST /api/internal/messages to persist.)

## SERVERS `/api/servers/*`

### GET /api/servers — Bearer → `{ servers: [{ id, name, description, iconEmoji, accentColor, isOfficial, memberCount, myRole: string|null (null if not joined), channels: [{id,name,topic,kind,position}] }] }` — all servers (discoverable), mine first.
### POST /api/servers — Bearer. Body `{ name (2-40), description?, iconEmoji?, accentColor? }` → create + owner ServerMember + channels: general(0), introductions(1), random(2) → `{ server }` (same shape as list item). Rate limit 5/hour.
### POST /api/servers/[id]/join — Bearer → ServerMember role 'member' + system message in #general "X joined the party 🎉" (via internal message fn directly) → `{ ok: true }`
### POST /api/servers/[id]/leave — Bearer (owner cannot leave; 403) → `{ ok: true }`
### POST /api/servers/[id]/channels — Bearer (owner/admin/mod). Body `{ name (2-24, lowercase-hyphenated) }` → `{ channel }`
### GET /api/servers/[id]/channels/[cid]/messages — Bearer + must be member. `?before=&limit=50` → `{ messages: MessageDTO[], hasMore }`
### GET /api/servers/[id]/members — Bearer member → `{ members: [{ user: MiniUser, role }] }`

## GIFTS `/api/gifts/*`

### GET /api/gifts/catalog — Public → `{ gifts: [{key,name,description,price,rarity,mood,xpReward}] }` (from GiftCatalog DB).
### POST /api/gifts/send — Bearer. Body `{ giftKey, recipientId, note? (≤200), contextType?: 'dm'|'post'|'live', contextId? }`
- Validate gift exists, recipient exists (not self, not blocked). Deduct coins (insufficient → 400 `{error:"Not enough Meev coins"}`).
- Create Gift. XP 'gift_sent' to sender (+ gift.xpReward bonus), 'gift_received' + gift.xpReward to recipient. Coins: sender loses price.
- Notification to recipient kind 'gift' + realtime broadcast to room `user:<recipientId>` event `gift:received` payload `{gift: GiftDTO}` AND to room `dm:<conversationId>` event `dm:new` a gift message if contextType='dm' (persist message kind 'gift' via internal fn, meta {giftKey, note}).
- Badge 'gifted' for sender on first gift.
- Response `{ gift: GiftDTO, coinsLeft }`.
### GET /api/gifts/history — Bearer → `{ sent: GiftDTO[], received: GiftDTO[] }` (last 50 each).

## NOTIFICATIONS `/api/notifications/*`

### GET /api/notifications — Bearer → `{ notifications: NotificationDTO[], unread: number }` (last 50, newest first).
### POST /api/notifications/read — Bearer. Body `{ ids?: string[] }` (omit = all) → `{ ok: true, unread: 0 }`.

## XP `/api/xp/*`

### POST /api/xp/heartbeat — Bearer. Body `{ activeSeconds: number (1..60), interactions?: number }` → accumulate user.activeSeconds; every 3600 → +1 XP (PointsLog 'heartbeat_hour'). Response `{ xp, level, activeSeconds, leveledUp: false, nextHourProgress: number (0-3600) }`.
### GET /api/xp/leaderboard — Public → `{ entries: [{ user: MiniUser, xp, level }] }` top 25 by xp.
### GET /api/xp/me — Bearer → `{ xp, level, progress: levelProgress, unlocks: LEVEL_UNLOCKS (filtered ≤ level) + next unlock, pointsLog: [{amount,reason,createdAt}] last 30 }`.

## MEDIA `/api/media/*`

### POST /api/media/upload — Bearer. multipart/form-data field `file`. Max MEEV_MAX_UPLOAD_MB (5MB). Validate REAL MIME via magic bytes (jpeg `FF D8 FF`, png `89 50 4E 47`, webp `52 49 46 46...57 45 42 50`, gif `47 49 46 38`). Reject everything else with 400 `{error:'Only image files (JPEG/PNG/WebP/GIF) are allowed'}`.
- Process with sharp: create WebP version (quality 82) `<name>.webp` + fallback JPEG `quality 85` `<name>.jpg` + thumbnail 320px `<name>_thumb.webp`. Save under `public/uploads/`. Never trust original filename (generate id-based name via newId()).
- Response `{ url: '/uploads/<id>.webp', fallbackUrl: '/uploads/<id>.jpg', thumbUrl: '/uploads/<id>_thumb.webp', width, height, bytes }`. Rate limit 20/min.
- Log suspicious (non-image magic bytes) to AuditLog 'suspicious_upload'.

### POST /api/media/tts — Bearer. Body `{ text (1-280) }`. Uses z-ai-web-dev-sdk TTS (`zai.audio.speech` or the SDK's TTS API — check skill docs in `/home/z/my-project/skills/TTS/SKILL.md`, follow it exactly; save mp3 to `public/uploads/tts_<id>.mp3` with fs). Response `{ audioUrl }`. Rate limit 10/min. If SDK fails → 500 `{error:'Voice synthesis failed, try again'}`.

## GAMES `/api/games/*`

### POST /api/games/xo/result — Bearer. Body `{ opponentId, won: boolean }` (called by realtime service or client at game end) → XP 'game_win' if won else 'game_play' + notification to opponent. `{ ok: true }`.

## INTERNAL `/api/internal/*` (x-meev-service-key header required — `requireServiceKey`)

### POST /api/internal/messages
Body: `{ scope: 'dm'|'server', conversationId?, channelId?, authorId, content, kind?: 'text'|'sticker'|'gift'|'system'|'poll'|'voice'|'game', attachmentUrl?, meta?: object }`
- Validates membership: dm → author is userA/userB of conversation; server → author is ServerMember of the channel's server. Blocks: dm blocked → 403.
- Sanitizes content (sanitizeText field 'message'), kind whitelist, meta JSON-stringified (only for poll/game/gift/sticker kinds).
- Slash command processing: if content starts with `/` and kind='text':
  - `/roll` → kind 'system', content `🎲 <displayName> rolled **<1-6>**`
  - `/8ball <q>` → kind 'system', content `🔮 <random 8ball answer>`
  - `/poll <question> | <opt1> | <opt2> [| opt3| opt4]` → kind 'poll', meta {question, options}, content=question
  - `/shrug` → content `¯\\_(ツ)_/¯`
  - `/help` → kind 'system' lists commands
  - unknown `/x` → kind 'system' content `Unknown command /x. Try /help`
- Persist Message. Update conversation lastMessageAt (dm). XP 'message' (max 1/30s per user — keep simple: always award, small). Response `{ message: MessageDTO }`.
- Also: if dm and recipient has no notifications... skip. (Realtime handles delivery.)

### POST /api/internal/ai-reply — Body `{ userId, history: [{ role: 'user'|'stranger', content }], strangerPersona?: string }`
- Uses z-ai-web-dev-sdk LLM (read `/home/z/my-project/skills/LLM/SKILL.md` and follow exactly; chat.completions.create with messages). System prompt: friendly, playful stranger on Meev 1v1 chat, short replies (1-3 sentences), match user's language (if user writes Arabic reply in Arabic), never reveal being an AI unless asked directly, keep it SFW, no personal data requests. thinking disabled.
- Response `{ reply: string }`. On failure → `{ reply: "😹 I zoned out for a second — say that again?" }` (never 500).

### POST /api/internal/xp — Body `{ userId, amount, reason }` → `{ xp, level, leveledUp: boolean, newLevel: number }`. On level-up: create Notification 'level_up' + realtime broadcast room `user:<id>` event `level:up` payload `{ level, xp }` + auto-grant level badges (lvl-10/50/100/999).
### POST /api/internal/notify — Body `{ userId, kind, title, body?, data? }` → `{ ok: true }` (+ realtime broadcast `notif:new` to room `user:<id>`).
### POST /api/internal/presence — Body `{ userId, presence }` → `{ ok: true }` (update User.presence).

## REALTIME MINI-SERVICE (port 3003, socket.io, path '/')

Frontend connects: `io('/', { path: '/', query: {} })` — WAIT, use: `io({ path: '/' , transports...})`? NO — per sandbox rules: `io("/?XTransformPort=3003")`. The client uses `io({ path: '/' })` with URL `/?XTransformPort=3003`... The exact pattern (see `examples/websocket/frontend.tsx`): `io("/?XTransformPort=3003", { path: "/" })`. The realtime service MUST use `path: '/'`.

Also HTTP endpoints on the same server (Express-style via node http server):
- POST /broadcast `{ room, event, payload }` + x-meev-service-key → emits to room. `{ ok: true }`
- GET /health → `{ ok: true, users: <n> }`

### Socket auth
Client emits `hello` `{ token: <accessToken> }` after connect. Server verifies JWT HS256 with shared secret (implement inline HMAC verify — same as src/lib/meev/auth.ts; copy the b64url helpers). Server keeps `sockets: Map<userId, Set<socket>>` and `online: Map<userId, {username, displayName, avatarSeed, level, presence, nameColor, isBot}>`. On success: socket.join(`user:<id>`), respond `hello:ok` `{ user: {id, username, displayName, avatarSeed, level, presence, nameColor, isBot}, online: [MiniUser[]] }`, broadcast `presence:update` `{userId, presence: 'online'}` to all. Also POST to Next `/api/internal/presence` (fire & forget). On disconnect (last socket for user): broadcast `presence:update` `{userId, presence:'offline'}` + internal presence update.

### Events (client → server)
- `presence:set` `{ status: 'online'|'busy'|'dnd' }` → update map + broadcast `presence:update` + internal presence POST.
- `dm:join` `{ conversationId }` → join room `dm:<id>` (validate not needed — read auth only).
- `dm:leave` `{ conversationId }` → leave room.
- `dm:send` `{ conversationId, content, kind?, attachmentUrl?, meta? }` → POST http://localhost:3000/api/internal/messages with x-meev-service-key (authorId = socket user). On 2xx: broadcast `dm:new` `{ message: MessageDTO, conversationId }` to room `dm:<id>` + also to `user:<partnerId>` room (for notification sounds) — internal messages response includes message. On error: emit back to sender `msg:error` `{ conversationId, error }`.
- `dm:typing` `{ conversationId }` → broadcast to room others `dm:typing` `{ conversationId, user: MiniUser }` (throttle 2s per user/conv).
- `server:join` `{ channelId }` → join `server:<channelId>`; `server:leave` `{ channelId }`.
- `server:send` `{ channelId, content, kind?, meta?, attachmentUrl? }` → same as dm:send with scope 'server' → broadcast `server:new` `{ message, channelId }` to room `server:<channelId>`.
- `server:typing` `{ channelId }` → `server:typing` `{ channelId, user }`.
- Matchmaking (Omegle-style):
  - `match:queue` `{ mode: 'text'|'video', interests?: string[] }` → join queue room. If another queued user with compatible mode → pair: create matchId, both socket.join(`match:<matchId>`), emit to each `match:found` `{ matchId, partner: MiniUser, mode, isAI: false }`, remove from queue. If queue empty → emit `match:waiting` `{ queueSize: 0 }` and start 10s timer; if still alone after 10s → auto-pair with MEEV_BOT (virtual MiniUser `{id:'meevbot', username:'meevbot', displayName:'Stranger Cat', avatarSeed:'honey|gold|1', level: 42, presence:'online', nameColor:'#f59e0b', isBot:true}`), `match:found` `{ ..., isAI: true }`.
  - `match:send` `{ matchId, content }` → if match isAI: emit `match:typing` to sender, call POST http://localhost:3000/api/internal/ai-reply `{userId, history: matchHistory}` (keep per-match history array in memory, cap 20), then emit `match:new` `{ matchId, message: {id: 'm_'+rand, author: botMini, content: reply, kind:'text', createdAt} }` to `match:<matchId>` room (sender only). If human match: broadcast `match:new` `{ matchId, message: {id, author: senderMini, content, createdAt} }` to room (both). Content sanitized (strip tags, max 1000). Rate: max 1 msg / 500ms per user.
  - `match:typing` `{ matchId }` → broadcast to room partner (only meaningful for human matches; for AI ignore — AI typing is server-driven).
  - `match:skip` `{ matchId }` → notify other human `match:partner-left` `{ matchId, reason: 'skipped' }`, both leave room. If AI match → emit `match:ended` to sender. Optionally re-queue if `requeue: true` in payload.
  - `match:end` `{ matchId }` → leave room, notify partner `match:partner-left` `{ reason: 'ended' }`. Session duration tracked; on end, emit `match:summary` to sender `{ matchId, seconds, isAI }` (frontend offers add-friend).
  - `match:report` `{ matchId, reason }` → POST http://localhost:3000 (need an endpoint: reuse /api/users/report with service key? Add internal: POST /api/internal/report `{reporterId, reason, targetUserId?}` → creates Report + notification to reporter 'moderation'. Then emit `match:report:ok`).
- XO game (in DM):
  - `dm:game:start` `{ conversationId }` → create in-memory game `{board: Array(9).fill(null), turn:'x', players: {x: starterId, o: partnerId}}` (partner = the other user in the DM; if partner not online in this service... the game still works when both open the DM; if partner offline → emit `game:error` `{conversationId, error:'Partner is offline right now'}`). Broadcast `dm:game:state` `{ conversationId, game: {board, turn, status, winner} }` to room `dm:<id>`.
  - `dm:game:move` `{ conversationId, cell: 0-8 }` → validate turn ownership + empty cell → update → broadcast `dm:game:state`. On win/draw: status finished, winner 'x'|'o'|'draw'; POST /api/internal/xp `{userId: winner, amount: 8, reason:'game_win'}` and loser 'game_play'; broadcast final state.
  - `dm:game:leave` `{ conversationId }` → broadcast state status 'abandoned'.

### Events (server → client)
`hello:ok`, `presence:update` {userId, presence}, `presence:online-users` {users: MiniUser[]} (broadcast on each connect/disconnect, capped 200 users), `dm:new` {message, conversationId}, `dm:typing`, `server:new` {message, channelId}, `server:typing`, `match:waiting`, `match:found`, `match:new`, `match:typing`, `match:partner-left`, `match:ended`, `match:summary`, `match:report:ok`, `dm:game:state`, `game:error`, `msg:error`, `notif:new` (from /broadcast), `gift:received` (from /broadcast), `level:up` (from /broadcast).

### Implementation requirements
- `mini-services/realtime/` is a standalone bun project: own `package.json` (name meev-realtime, scripts: `"dev": "bun --hot index.ts"`), install `socket.io`. Entry `index.ts`. Port 3003 hardcoded.
- Own `.env` NOT needed — read shared secrets from process env fallback: put `MEEV_JWT_SECRET` and `MEEV_SERVICE_KEY` values directly in a `config.ts` constant (values: same as /home/z/my-project/.env: MEEV_JWT_SECRET=m33v-super-secret-jwt-key-2027-change-in-production, MEEV_SERVICE_KEY=m33v-internal-service-key-2027) with `process.env.X ?? fallback`.
- Use `fetch` (bun native) to call Next internal APIs at `http://localhost:3000`.
- Log to console with timestamps. Handle errors gracefully (never crash the service).
- Next dev server is already running on port 3000 (dev.log in project root).

## SEED DATA (`prisma/seed.ts`, run with `bun prisma/seed.ts`)

Create via db client:
- BadgeCatalog + GiftCatalog rows from constants (BADGES, GIFTS).
- MeevBot user: id 'meevbot', username 'meevbot', displayName 'Stranger Cat', email 'bot@meev.local', random passwordHash, avatarSeed 'honey|gold|1', isBot true, bio 'Your friendly 1v1 stranger 🐾', level 42 (xp 1008), badge 'founder'.
- 14 demo users (all emailVerified): usernames: mochi, luna, pixel, whiskers, nala, simba, mika, oreo, pepper, shadow, marmalade, tofu, muezza, pixel2 → creative display names, varied avatarSeed, bios, cities (mix: Riyadh, Jeddah, Dubai, Cairo, Doha, Istanbul, Tokyo, Casablanca...), interests 3-6 each (overlapping with each other), varied XP levels: e.g. mochi level 68 (xp 1632), luna level 120 (2880), pixel level 999 (xp 23976 — the Meev Legend with lvl-999 badge), whiskers level 5, nala level 34, simba level 12, mika level 55, oreo level 3, pepper level 9, shadow level 77, marmalade level 21, tofu level 2, muezza level 44. Give each 300-800 coins. Presence mix. Badges: assign founder to all, lvl-N badges per level, social-butterfly to some.
- Follows: organic web (~60 rows). FriendRequests accepted (~20 friend pairs). 2-3 pending requests to the demo user? The real user registers fresh — pending friend request FROM mochi TO nobody... Friend requests are between demo users; for the fresh user's notifications demo, suggestions + a welcome notification suffice. Actually: make 3 demo users follow whoever registers? Not possible at seed time. Skip.
- Posts: ~18 posts from demo users using images in /meev-media/ (gaming.png, anime-city.png, cat-cafe.png, synthwave.png, dev-setup.png, cat-portrait.png, cover-aurora.png, cat-squad.png — verify files exist in public/meev-media; only reference files that exist, others text-only) + text-only posts, content social-media style, timestamps spread over last 5 days, likes ~random 3-40 (create Like rows), comments ~20 total.
- Stories: 6 demo stories (text gradient + 2 image) expiring in 20h, created 1-6h ago.
- Servers: "Meev Café ☕" (official, owner meevbot, members: all demo users, channels general/introductions/random/cat-pics), "Gaming Den 🎮" (owner mochi, 8 members, channels general/lfg/clips), "Anime Alley 🌸" (owner luna, 7 members, channels general/manga-discussion/waifu-wars), "Dev Lounge 💻" (owner pixel, 6 members, channels general/help-showcase, code-review).
- Server messages: ~30 messages across channels (casual conversation, some with reactions — create Reaction rows), last messages recent.
- DM conversations: a few between demo users with messages.
- Notification for each demo user: system welcome.
- Deterministic-ish ids: use newId().
- Use `upsert`-style guards: script must be re-runnable (skip if users already exist — check `db.user.count() > 5` → wipe? Simplest: `db.$executeRaw` deletes for all tables then re-seed: delete in FK-safe order). Wipe & re-seed is fine for demo. NEVER wipe if the flag `--keep` given. Always print summary at end.
- Passwords for demo users: 'Meev1234!' (all) — document this in seed output + they can log in with these accounts (demo accounts login is a feature: login form hint "Try a demo account: mochi / Meev1234!").

## Frontend pages
The frontend lives in `src/components/meev/*` (built by the lead agent). Backend agents must NOT touch `src/components/**`, `src/app/page.tsx`, `src/app/layout.tsx`, or `src/app/globals.css`.

## Testing
- Next dev server: `bun run dev` (already running in background, port 3000, logs at dev.log).
- Test endpoints with curl. Verify lint passes: `bun run lint`.
- Verify the realtime service with `bun run dev` inside mini-services/realtime (run in background, log to mini-services/realtime/service.log).

---

# V3 ADDENDUM (PawCoins economy hardening, streaks, chat themes, profile v3)

## Schema (all pushed & seeded)
- User += `coverKey` (cv-*), `profileEffect` (pe-*), `avatarAnim` (Boolean, level-999 unlock)
- DMConversation += `streakDays Int`, `lastStreakDate DateTime?`, `streakNotified Int`, `themeKey String`, `mutedA/mutedB Boolean`, `deletedA/deletedB DateTime?`
- NEW model `CoinLog { id, userId, delta Int, reason, balanceAfter Int, contextId, createdAt }` — every coin movement MUST go through `spendCoins/grantCoins` (src/lib/meev/coins.ts)

## Economy rules (v3)
- SPIN: weekly (SPIN_COOLDOWN_HOURS=168), prizes 0–5 coins (SPIN_MAX_COINS=5). Atomic claim (conditional updateMany on lastSpinAt). Route /api/rewards/spin updated.
- Shop purchase + gift send: atomic `spendCoins` (conditional UPDATE coins >= price) + CoinLog. Routes updated.

## New shop types (SLOT_COLUMN in equip route + seed)
- `name_color` → User.nameColor (holds item key `nc-*`; frontend resolves via SHOP_ITEMS payload {color, shine?, neon?, rainbow?}; raw hex from the free palette still allowed)
- `profile_effect` → User.profileEffect (`pe-*`, payload {effect})
- `cover` → User.coverKey (`cv-*`, payload {cover})
- `animated_avatar` → User.avatarAnim Boolean (single item `aa-legend`, level 999)

## New endpoints (Task 12-a)
- `PATCH /api/dms/[id]/settings` body `{themeKey?: string, muted?: boolean}` → `{ok, streakDays, themeKey, muted}`. Participant only. Theme must be unlocked: CHAT_THEMES.find(t=>t.key===themeKey).requiredStreak <= conv.streakDays (else 400). Mute sets mutedA/mutedB for the CALLER side.
- `DELETE /api/dms/[id]` → `{ok}` — "delete for me": sets deletedA/deletedB = now for the caller. Hidden from the caller's list until lastMessageAt > deletedAt.
- `GET /api/dms` response items += `{streakDays, themeKey, muted}` (muted = caller-side flag); conversations hidden when deletedX != null && deletedX >= lastMessageAt.
- `GET /api/dms/[id]/messages` response += `{streakDays, themeKey, muted}`.

## Streak logic (messages.ts — Task 12-a)
On each DM message create: compute UTC day of now. If conv.lastStreakDate == today → no change. If == yesterday → streakDays+1. Else → streakDays = 1. Set lastStreakDate=today. When a multiple-of-3 milestone (3,6,9,…) is crossed AND > streakNotified: streakNotified=that number, create a bilingual system message ("🔥 … days! theme unlocked"), notify both users (kind 'system'), broadcast dm:new with the system message.

## Profanity (src/lib/meev/profanity.ts — READY, consume it)
- `filterProfanity(text)` → {masked, hard, text} — mask soft (🙈), reject hard (HTTP 400 or MessageError).
- Apply in: createMessage content (kind text/poll/voice? — text paths), gift note, POSTS content, COMMENTS content, profile bio/displayName (PATCH users/me), register displayName/username (containsProfanity → 400), support ticket message.
- Realtime service also relays raw content — masking at persist time is authoritative (refetch shows masked).

## Frontend contract
- types.ts: MiniUser += coverKey?, profileEffect?, avatarAnim?; Conversation += streakDays?, themeKey?, muted?
- api.ts: dmSettings(id, {themeKey?, muted?}), deleteDm(id) added.
- PawCoinIcon now renders the REAL brand cat (public/meev-coin-cat.png) on a gold coin.
- TopBar: lang toggle REMOVED (settings only); bell opens NotifBell popover (notif-panel.tsx).
- PawDock: physical sides RIGHT=Explore+Chats, LEFT=Live+Shop, center gap, lowered (bottom 0.45rem), dir="ltr" toe row.
