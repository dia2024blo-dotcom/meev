# MEEV 🐾 — One app. Every way to hang out.

> **Meev** is a social super-app that fuses the best of Discord (servers, voice-style
> rooms, badges, status), Instagram (profiles, feed, notes) + **the PULSE system**
> (stories reborn as a living constellation), Omegle (random 1v1), and **TikTok/Hala-style
> support gifting (the box explodes and doves fly out over the whole screen)** —
> wrapped in a living cat-mascot identity with a full gamification economy and **Gold Meev** currency.

> **v16 (the launch build):** gifting is now DM/live-only with a hard **24-gifts/24h** cap and
> gifts **credit the recipient's account** (a gift IS the coin transfer); levels come
> **only** from interaction time (**1 point per active hour · 24 points = 1 level**) —
> no XP for messages, gifts, spins, games or logins; Gold is a **hard currency**
> (1 per 6 active hours + 5 per level-up + weekly spin ≤5 + gifts you receive);
> **Facebook-style 7-emoji reactions** (👍❤️🥰😂😮😢😡 — bare emojis, hover-wiggle picker,
> no circles); the DM gift is **the real gift itself — a clean sticker with no background**;
> the settings **"download the site" shortcut is gone**; About = "Meev" (no v2);
> the Arabic **"online now" toggle is fixed** (stale-closure + RTL thumb direction);
> the language-restart overlay speaks the **gold identity** (sunset colors removed);
> the background is a **calm living layer** (slow gold dust + breathing aurora + a rare
> gold shooting star every 18–40s); and production builds are code-protected
> (minified, no source maps, **F12 / view-source / right-click guarded**).
>
> **v17 polish:** the living background is now **actually visible site-wide** — the
> app/auth wrappers no longer paint an opaque page color over the canvas (CSS
> paint-order fix; body paints the page color), with tuned visibility: clear gold
> dust (0.10–0.18), twinkling stars with halos (0.4–0.8), a floor of 36 particles on
> phones / cap 110 on desktops, and a brighter meteor head. **Explore is fully
> localized now** — tabs, search bar, "Any interest", Go, suggestion cards (match %,
> shared-interest chips, proper singular/plural "mutual"), toasts and room cards all
> speak the active language; interest labels are shared across Explore/onboarding/
> live-match/profile through the new `interestLabel()` helper (ar inline, fr/es/tr/de
> via the dictionary).

> **v20 — limited-by-design staff powers + the owner's all-seeing audit:**
> the permission ladder is rebuilt per the owner's spec — **support** answers
> tickets and helps people only (no mute); **moderator** adds mute/unmute/
> strikes/clear; **admin** gets the moderator set ONLY — deliberately NO
> verify, NO rank-granting, NO badges, NO coins, NO ban; **superadmin** holds
> the serious powers (ban ≤30d · verify · coins); **owner** keeps everything
> plus the exclusive trio `role` / `delete` / **`audit`** — a live audit-trail
> command answering "who used which command / who gave coins / who replied to
> a ticket", with the staff member's name, timestamps and one-line summaries
> (25 per page, filter by staff: `audit @othman`). `help` now prints the full
> role × command matrix inside MeevCMD, the console side panel is owner-only
> (and includes ticket replies), and quick-command chips are filtered to each
> rank's real permissions. The demo login buttons + visible demo passwords on
> the auth screen **auto-hide in production hosting** (`NEXT_PUBLIC_MEEV_DEMO=1`
> to force-show for a live demo).

> **v19 — the support desk is real now:** a user opens a ticket in
> **Settings → Support → «New ticket»** and it lands instantly at the desk (🆕 open,
> with an instant bilingual auto-ack). Staff (support+) read and answer it from
> **MeevCMD** with three commands — `tickets` (the desk inbox: 🆕 awaiting a
> human · ✅ answered, `tickets open` for the backlog), `ticket <id>` (the full
> ticket: from/category/subject/message) and `reply <id> <text>` (the human reply —
> it **replaces the auto-ack**, flips the ticket to ✅, pushes the user an instant
> «💬 ردّ فريق الدعم على تذكرتك» notification + live socket delivery, and lands in
> the audit log with the staff member's name). The user sees the whole thread in
> **«My tickets»**: their message + the «فريق ميف» bubble with the real reply + the
> «Answered» badge.

- **Demo account:** `mochi` / `Meev1234!` (admin-seeded showcase user)
- **Owner account:** `othman` / `Meev-Owner-2027` → email `othmanxbaroum@gmail.com` —
  full staff powers through the **MeevCMD** terminal (ban/mute/verify/coins/roles/delete)
- **Language:** Arabic-first (RTL) + English · **French / Español / Türkçe / Deutsch** in Settings
- **Theme:** Dark (signature, true-black) + Light (pure white) — crescent toggle in Settings

---

## 1 · What is inside (feature map)

| Area | Features |
|---|---|
| **Home** | **MEEV PULSE (نبض)** — the stories system: every circle wears a TIME-DECAY RING tinted by the author's VIBE, constellation threads link "moment partners", vibe composer with live particle preview; the **STORY CINEMA** full-bleed viewer (Ken-Burns zoom, ambient particles, reaction bursts, double-tap heart, keyboard nav); **v16: post reactions are Facebook-style — the full 7-emoji set on a hover/long-press picker bar (each emoji springs in, pops and wiggles), the summary is bare stacked emojis + count (NO circles), and tapping the photo bursts the actual emoji**; feed (posts/likes/comments), composer, closable weekly rewards bento (spin 0–5 Gold/week, level progress with the "1 hour = 1 point" rule) |
| **Explore** | Friend suggestions (mutuals/interests scoring), search with filters + **v16: the "Online now" toggle works correctly in Arabic too (RTL-fixed switch + immediate re-search with the new value — was reversed)**, trending |
| **Live 1v1** | Omegle-style random matching with the AI companion, skip/queue — fully bilingual — TikTok-style room: live effects tray, quick-gift tray (one-tap real Gold Meev) and rising gift animations with sender chips — **gifts land here (support gifting) — one of only two gifting surfaces** |
| **Messages** | Realtime DMs (socket.io), stickers, emoji packs, slash-commands, RPS duels, XO board, TTS voice notes, streak flames 🔥 + chat themes, mute/delete/block/report, Instagram-style Notes as thinking CLOUDS 💭, read receipts ✓✓ «شوفت/Seen», **GiftCinema 🎬 takeover on send** · **v16: a DM gift renders as THE GIFT ITSELF — a clean big-emoji sticker (no card, no image, no background plate) with the name, rarity and a "+N 🪙 to their account" credit chip; tap = the explosion; the gift message is fully transparent in the thread** |
| **Servers** | Discord-style communities, channels, members, roles |
| **Profile** | Cover art, profile effects, hero with cover-floating actions, honor constellation badges, stats, XP bar, interests, cosmetics showcase, photo avatar, Discord-style status picker + custom status, change locks |
| **Shop** | 71 items across 9 categories (incl. 🪄 Name Effects), level-gated VIP badges — Gold Meev economy with atomic purchases + CoinLog ledger · **v16: purchases grant the item only (coins-only price, level shown — never XP)** |
| **Gifts** | 26 gifts — the support cinema detonates as a 3-act scene with creatures flying out (doves, butterflies, kittens, fireworks, dragon, phoenix…) · **v16 (user spec): gifts can ONLY be sent in PRIVATE CHATS and LIVE rooms — never on posts (the post gift button is removed); hard daily budget of 24 gifts / rolling 24h; every gift TRANSFERS its full coin value to the recipient's account the moment it is sent** |
| **Staff (v5+v6+v16+v19+v20)** | **MeevCMD terminal** — **v20 limited-by-design ladder: support = tickets/whois only · moderator = +mute/unmute/strikes/clear · admin = moderator's set ONLY (no verify/ranks/badges/coins/ban) · superadmin = +ban(≤30d)/verify/coins · owner = +role/delete/`audit`** — `help` prints the full role × command matrix, quick chips are permission-filtered, the audit side panel is owner-only and includes ticket replies · ban · unban · mute · unmute · verify · unverify · coins (+/−) · role · delete · whois · strikes · clear, all with audit logs + bilingual notifications, **rank chips next to names** (👑 owner · ⚡ superadmin · 🛡️ admin · 🎧 support · ⚙️ mod) + animated verified seals · **the REAL CLI terminal `bun meev-cli.ts`** (owner/superadmin/users/logs/sessions/passreset/owner-setup) — see `docs/meev-cmd.md` |
| **Gamification (v16)** | **1 point per completed active hour · 24 points = 1 level · cap 999 = LEGEND.** The hourly engine is inflation-proof (server credits only real elapsed time). No other XP source exists on the platform. |
| **Settings** | Two-nav layout with 6 clean sections (Appearance/Account/Privacy & Safety/Support/About/Danger Zone); language switching via the LanguageSheet → light restart (**v16: the restart overlay is brand gold — the old sunset gradient flash is gone**); account (name/email/password/2FA/sessions), privacy, blocked users, community rules, support tickets (**v19: «My tickets» shows the full thread — your message, the instant auto-ack, then the «فريق ميف» human reply + «Answered» badge once staff replies**), **About = "Meev"** (**v16: the public "download the site files" shortcut is REMOVED — visitors can never pull the source from the app**), Danger Zone self-service account deletion |
| **Safety & protection** | Automated rules engine (spam/insults/self-harm ladders), bilingual profanity filter, hourly rate limits, AI NSFW image screening on upload, owner-level bans, block/report, audit logs, economy anti-exploit, real presence (3-min liveness gate), login lockout + IP ceiling · **v16: production code protection — DevGuard blocks F12 / Ctrl+Shift+I/J/C / Ctrl+U / Ctrl+S and the context menu in production builds, production browser source maps are OFF, no framework banner** |

---

## 2 · Tech stack

- **Next.js 16 (App Router) + TypeScript 5 + React 19** — single-page app shell (`src/app/page.tsx` → `src/components/meev/app.tsx`)
- **Tailwind CSS 4 + shadcn/ui (New York)** + custom Meev design language (`globals.css`)
- **Framer Motion** — dock physics, gift explosions, celebrations
- **Prisma ORM + SQLite** (`prisma/schema.prisma`, file at `db/custom.db`)
- **Zustand** store (`src/components/meev/store.ts`)
- **socket.io realtime mini-service** (`mini-services/realtime`, port 3003) behind the Caddy gateway (port 81 → `?XTransformPort=3003`)
- **z-ai-web-dev-sdk** — server-side only (TTS, LLM stranger replies, **vision-based NSFW moderation**)

---

## 3 · How to run

```bash
bun install            # deps
bun run db:push        # apply prisma schema → db/custom.db
bun prisma/seed.ts     # demo data (mochi, luna, servers, shop, gifts… + owner othman at level 999)
bun run dev            # Next.js on :3000
cd mini-services/realtime && bun install && bun run dev   # realtime :3003
bun meev-cli.ts        # the REAL staff terminal in the site files (owner)
```

Open `http://localhost:3000` (or the gateway `:81` for full socket.io support).

### 3b · Hosting it on the internet (production)

```bash
bun install
bun run db:push                       # fresh database (or keep the shipped db/custom.db)
bun run build                         # production build (minified, no browser source maps)
bun run start                         # serve on :3000 (set PORT if you must)
cd mini-services/realtime && bun install && bun run dev   # realtime :3003
```

- Put a reverse proxy in front that forwards `/` → :3000 and **`/?XTransformPort=3003`** → :3003
  (the shipped `Caddyfile` does exactly this on port 81 — reuse it).
- `.env` needs `DATABASE_URL`, `MEEV_JWT_SECRET`, `MEEV_SERVICE_KEY` (random secrets),
  and `MEEV_SMTP_MODE` (use `demo` only when you have no mail transport).
- **Code protection is automatic in production builds:** visitors get minified bundles
  with no source maps, F12 / view-source / right-click are guarded by DevGuard, and the
  app never exposes its source (the settings download shortcut was removed in v16).
- Keep `db/custom.db` backed up — it IS your whole world (users, posts, coins, everything).

---

## 4 · File map (what each file does)

### App shell & routing
| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout: fonts, metadata, ThemeProvider (next-themes, class mode), Toaster |
| `src/app/page.tsx` | The single user-visible route — mounts `<MeevApp />` |
| `src/app/globals.css` | Design language: theme tokens (true-black night / pure-white day), Meev gradients, glass, animations (incl. the v16 reaction wiggle), shop cosmetics FX |

### Core frontend (`src/components/meev/`)
| File | Purpose |
|---|---|
| `app.tsx` | App shell: boot → auth gate → layout (TopBar + views + PawDock), global realtime wiring (gifts, coins, level-ups, notifications), XP heartbeat |
| `store.ts` | Zustand store: me, view, dm, notifications, socket state, heartbeat (+ **v16: the heartbeat carries the hourly point AND the scarce coin trickle**) |
| `api.ts` | Typed REST client (auth, users, posts, dms, gifts, shop, xp, support…) with token refresh |
| `socket.ts` | socket.io client (`/?XTransformPort=3003`) with typed event helpers |
| `i18n.tsx` | Multi-language provider: `L(ar, en)` + dictionary lookup for **fr/es/tr/de** + RTL/LTR direction + **v16: the gold light-restart overlay** |
| `i18n-dict.ts` | French/Spanish/Turkish/German translation dictionary + the 6-language registry |
| `meev-switch.tsx` | MeevSwitch: the REAL iOS-style toggle (big pill, spring thumb, glow, busy spinner) used for 2FA |
| `admin-console.tsx` | MeevCMD: the staff terminal (boot banner, command history, audit-log panel, quick commands — **v16: superadmin included**) |
| `auth-view.tsx` | Login/register/guest panel with one-tap demo chip, 2FA OTP flow |
| `top-bar.tsx` | Control deck: brand, live user search, Gold balance, servers, notifications, settings, account menu |
| `paw-dock.tsx` | Flat bottom navigation: Live+Shop (left) · cat main menu (center, brand gold halo) · Explore+Chats (right) — hides inside an open chat thread |
| `notif-panel.tsx` | Facebook-style small notification popover |
| `home-view.tsx` | **MEEV PULSE** rail + vibe composer + STORY CINEMA full-bleed viewer + feed + composer + rewards bento · **v16: the 7-emoji Facebook reactions (picker bar + wiggle + bare-emoji summary + emoji burst), post gifting REMOVED, composer/shop texts XP-free** |
| `explore-view.tsx` | Suggestions, search results, trending · **v16: the online-only toggle fix (immediate search with the new value, translated label)** |
| `live-view.tsx` | 1v1 random matching + AI companion chat — fully bilingual — support gifts detonate the SupportCinema on BOTH partners' screens (gifting surface #2) |
| `messages-view.tsx` | DM list + Notes bar (thinking CLOUDS 💭) + full chat thread (stickers, commands, games, gifts, themes, streaks, safety menu) + seen ticks live via `dm:read` |
| `servers-view.tsx` | Communities: server list, channels, members |
| `profile-view.tsx` | Living profile (cover, effects, honor badges, stats, XP) + photo-only edit dialog + status picker + change locks + LEGEND COVER STUDIO |
| `shop-view.tsx` | 9-category store with owned/locked states, legend banner, power ladder |
| `settings-view.tsx` | Organized two-nav settings (6 sections) — **v16: About = "Meev" only, the site-download shortcut is GONE** |
| `gifts-view.tsx` | Gift wallet: catalog, sent/received history, stats |
| `gift-dialog.tsx` | Gift picker — **v16: DM/live contexts only, the "24 gifts / 24h" limit is shown in the dialog, success toast shows the coin transfer** |
| `gift-box.tsx` | **v16: THE GIFT STICKER — a DM gift renders as the real emoji (big, clean, NO card/background) + name + rarity + "+N 🪙 to their account" credit chip; tap = the explosion burst** |
| `gift-cinema.tsx` | The SUPPORT CINEMA — the 3-act support takeover (box drops → detonates → creatures fly out) in DMs, live rooms and profiles |
| `chat-shared.tsx` | Chat bubbles, typing dots, slash hints, reactions, time helpers · **v16: gift/sticker/game messages are PLATELESS (no bubble background — the inline gradient that beat `!bg-transparent` is gone)** |
| `cat-avatar.tsx` | Deterministic avatars: monograms for photo-less users, drawn MeevCat for brand contexts, frames, accessories, 999 animated mode, PresenceDot |
| `logo.tsx` | The living Meev cat logo (moods, blinking, pupil tracking) + splash |
| `username.tsx` | Styled names: colors, gradients, shop effects, level pill, name-EFFECT slot, **v16: superadmin rank chip added** (👑 owner · ⚡ superadmin · 🛡️ admin · 🎧 support · ⚙️ mod) + verified badge |
| `profile-fx.tsx` | Profile covers + hero particle effects |
| `celebration.tsx` | Full-screen level-up / gift / 999-LEGEND takeovers |
| `spin-wheel.tsx` | Weekly rewards wheel (0–5 Gold — **v16: coins only, never XP**) |
| `pawcoin.tsx` | Gold Meev coin icon + balance chip |
| `moderation.tsx` | Report dialog + block button (shared UI) |
| `mute-registry.ts` | Caller-side muted-conversation flags (toast suppression) |
| `legend-jump.ts` | Shop deep-jump signal (999 → Legend tab) |
| `language-sheet.tsx` | The login-style language switcher: `LanguageLaunchButton` (globe) + `LanguageSheet` (6-language picker → setLang + profile save + gold light restart) |
| `pulse-ring.tsx` | The own-pulse Instagram-style gold ring (breathes while live, melts to transparent once you watch your own pulse) |
| `dev-guard.tsx` | **v16: production code protection** — blocks F12 / Ctrl+Shift+I/J/C / Ctrl+U / Ctrl+S + right-click, prints the console notice; asleep in dev |
| `types.ts` | Frontend DTO contract types (**v16: 7 reaction kinds**) |

### Backend libs (`src/lib/meev/`)
| File | Purpose |
|---|---|
| `db.ts` | Prisma client singleton |
| `auth.ts` | Password hashing, JWT access tokens, refresh cookies, sessions, OTP |
| `auth-flow.ts` | Register/login/2FA orchestration |
| `guard.ts` | Route guard: bearer auth + owner-ban gate + liveness heartbeat + error helpers |
| `admin.ts` | **MeevCMD engine** — command parser, staff permissions (**v20 limited-by-design ladder: user 0 · support 1 (tickets+whois) · moderator 2 (+mute/strikes/clear) · admin 3 (moderator set ONLY) · superadmin 4 (+ban/verify/coins) · owner 5 (+role/delete/audit)**), ban/mute/verify/coins/role/delete with audit + notifications, `help` = the full role matrix, **v19 support desk: `tickets` / `ticket` / `reply` (support+; human reply replaces the auto-ack, audit-logged as `ticket_reply` with the staff name, instant user notification)**, **v20 `audit [page] [@staff]` — the owner's live view of every staff action (incl. ticket replies) with Arabic labels + summaries** |
| `nsfw.ts` | AI moderation — vision-model image classification, fail-open, timeout |
| `messages.ts` | Unified message pipeline: validation, slash commands, RPS duels, streak engine, rules engine hook (**v16: no XP for messages/duels**) |
| `moderation.ts` | Rules engine — spam/insult/self-harm detection, strike ladders |
| `profanity.ts` | Bilingual profanity filter (soft mask / hard reject) |
| `rate-limit.ts` | In-process sliding-window limiter (per-route windows) |
| `sanitize.ts` | XSS stripping, length caps, whitelisting |
| `coins.ts` | Atomic Gold Meev spend/credit + CoinLog ledger (**v16: `grantCoins` now also credits gift recipients**) |
| `gamify.ts` / `xp.ts` | XP awards (heartbeat only), level math (24 XP/level, cap 999), unlocks |
| `commands.ts` | Slash-command processor (/roll /8ball /poll /flip /hug … /rps) |
| `dto.ts` / `serialize.ts` | Privacy-aware DTO mappers (**v16: 7-kind reaction counts**) |
| `realtime.ts` | Server-side broadcast/notify bridge to the :3003 service |
| `similarity.ts` | Friend-suggestion scoring (mutuals + interests) |
| `message-list.ts` | Message list assembly helpers |
| `ids.ts` | Snowflake-style id generator |
| `constants.ts` | Palettes, shop catalog, gifts, themes, streaks, prizes, rules copy · **v16: the studied economy — `XP_PER_HOUR=1`, `XP_PER_LEVEL=24`, coin trickle (1 per 6h), level bonus (+5), `GIFT_DAILY_LIMIT=24`, spin prizes coins-only** |

### API routes (`src/app/api/**`)
Auth (`register/login/me/refresh/logout/2fa/guest/verify-email/forgot/reset/sessions`),
users (`me/[id]/follow/friend-request/blocklist/report/search/suggestions`),
posts (`feed/trending/[id]/like/comments` — **v16: the 7-kind like route, no XP**),
stories (+view · react · viewers · delete), dms (`[id]/messages/settings` + read receipts),
servers, gifts (`catalog/send/history` — **v16: send is DM/live-only + 24/24h cap + recipient coin credit + auto-DM resolution**),
shop (`catalog/purchase/equip` — **v16: no XP**), xp (`me/heartbeat/leaderboard` — **v16: heartbeat = XP + coin trickle + level bonus**; the internal xp mint is RETIRED/410),
rewards (`spin` — coins only), media (`upload` + AI NSFW screening, `tts`), support (1 ticket/week), notifications, games,
**admin (`command` + `logs`)**, plus internal service endpoints.

### Realtime mini-service (`mini-services/realtime/`)
| File | Purpose |
|---|---|
| `index.ts` | socket.io server (auth handshake, rooms, wiring) |
| `chat.ts` | DM/server relays → persist via internal API → broadcast |
| `matchmaking.ts` | Omegle-style 1v1 queue/skip |
| `presence.ts` | Online users, presence fan-out |
| `internal.ts` | Authenticated HTTP client for the Next.js monolith |
| `config.ts` / `util.ts` / `types.ts` | Ports, service key, sanitizers, shared types |

### Database (`prisma/`)
`schema.prisma` — 25 models (User w/ cosmetics + customStatus + verified + bannedUntil +
change-locks + staff roles **incl. superadmin** + `activeSeconds`/`lastHeartbeatAt` for the
hourly engine, Session, RefreshToken, EmailToken, AuditLog, Follow, FriendRequest, Block,
Report, Post, Comment, Like (**7 reaction kinds**), Story(+View), Server/Channel/Member,
DMConversation, Message, Reaction, MiniGame, PointsLog, Badges, Gift(+Catalog),
Notification, ShopCatalog/UserItem, CoinLog, SupportTicket) · `seed.ts` — the demo world
+ the owner account at level 999 with 999,999 Gold and every item.

### Site files (root)
| File | Purpose |
|---|---|
| `meev-cli.ts` | **The REAL CMD** — an interactive owner terminal (`bun meev-cli.ts`) + one-shot mode, reusing the MeevCMD engine with CLI-only powers (**v16: `superadmin <user>`** / owner-setup / owner / users / logs / sessions / passreset) |
| `docs/meev-cmd.md` | The staff guide: ladder, permissions matrix, three ways to grant roles, owner powers, full command table, **v19: the complete support-desk cycle (section 6)** |
| `next.config.ts` | Security headers + **v16: `productionBrowserSourceMaps: false` + `poweredByHeader: false`** |
| `Caddyfile` | The gateway config (`:81` → Next :3000 · `?XTransformPort` → any service) |

---

## 5 · The economy & the rules (v16 — the studied design)

**Levels (reputation, cannot be bought or farmed):**
- **1 point per completed active hour** of real interaction (the server only credits
  time that actually elapsed — a spamming client accrues nothing).
- **24 points = 1 level** · level 999 = LEGEND (animated avatar + custom covers).
- There is NO other XP source: no XP for messages, gifts, spins, games, posts,
  comments, likes, logins, purchases or registration. A level is pure time-in.

**Gold Meev 🪙 (hard currency — deliberately scarce):**
- **+1 per 6 completed active hours** (max ~4/day for the truly hardcore),
- **+5 the moment a new level is reached**,
- **+ the full coin value of every gift you RECEIVE** (a sent gift IS the transfer),
- **+ 0–5 from the weekly spin** (one spin per 7 days),
- − gifts you send · − shop items.
- Every movement is atomic and logged (`CoinLog`); the shop claims items before
  spending (race-proof) and PATCH forgery is blocked.

**Gifting (v16 rules):**
- Gifts live **only in private chats (DMs) and live rooms** — never on posts.
- **24 gifts per rolling 24 hours** per sender (the dialog tells you, the server enforces it).
- A gift **credits the recipient's account instantly** and renders in the chat as
  the real gift — a clean big-emoji sticker with the "+N 🪙 to their account" chip.

**Community rules** (enforced automatically on messages/posts/comments/stories):
1. **Spam/ads** — warning → 10-min mute → 1-hour mute → 24-hour suspension
2. **Insults** — warning + block → 30-min mute → 24-hour mute → 3-day suspension
3. **Self-harm threats** — message blocked + supportive reply; repeated blackmail → 24h suspension

**Anti-flood** — 6 posts/hour · 30 comments/hour · 6 stories/hour · **24 gifts/24h** ·
1 support ticket/week · 30 story reactions/hour.

**Account security** — 5 failed logins → 15-minute lock, per-IP ceilings, 2FA (email code).

**Real presence** — "online" means actually active: a 3-minute staleness gate turns
abandoned sessions offline. No ghost "online" statuses.

---

## 6 · CMD — the owner terminal (أوامر الطرفية)

Run it from the site root: **`bun meev-cli.ts`** (interactive, history ↑/↓) or one-shot
**`bun meev-cli.ts "whois @mochi"`**. The actor is always the OWNER account.

### Engine commands (work in-app in MeevCMD AND in the CLI)

| Command | Rank needed | What it does |
|---|---|---|
| `tickets [open]` / `ticket <id>` / `reply <id> <text>` | **v19 support desk** — inbox (🆕 awaiting human · ✅ answered), full ticket read, human reply that replaces the auto-ack and notifies the user |
| `help` | any | the command list |
| `whois @user` | support+ | full account data (level, gold, strikes, mute/ban) |
| `mute @user 30m\|2h\|7d [سبب]` | support+ | mute (with reason → user notified in AR+EN) |
| `unmute @user` | support+ | lift the mute |
| `strikes @user` | support+ | the violations record |
| `clear @user` | moderator+ | wipe strikes |
| `verify @user` / `unverify @user` | moderator+ | the verification seal |
| `ban @user 7d\|permanent [سبب]` | moderator+ (≤30d) / admin+ (any) | ban + kill all sessions instantly |
| `unban @user` | moderator+ | lift the ban |
| `coins @user +500` | admin+ | **grant Gold Meev** (audited + CoinLog) |
| `coins @user -100` | admin+ | **remove Gold Meev** (never below 0) |
| `role @user <support\|moderator\|admin\|superadmin\|user>` | superadmin+ | change rank (only the owner mints superadmins) |
| `delete @user confirm` | superadmin+ | **delete the account forever** (with everything cascading) |

### CLI-only commands (`bun meev-cli.ts` only)

| Command | What it does |
|---|---|
| `owner <username>` | promote to **owner** (rank 5) |
| `superadmin <username>` | promote to **superadmin** (rank 4 — all admin powers + role + delete) |
| `owner-setup <user\|email>` | full owner upgrade: rank + level 999 + 999,999 Gold + every item + verified |
| `users [n]` | latest users table |
| `logs [n]` | audit-log tail |
| `sessions <user> [revoke]` | list / kill active sessions |
| `passreset <user> <newPass>` | reset a password |
| `cls` / `exit` | clear / leave |

The same engine runs in-app (MeevCMD view — staff only) with the same permission ladder:
**user 0 · support 1 · moderator 2 · admin 3 · superadmin 4 · owner 5**.

---

Made with care · Meev © 2027
