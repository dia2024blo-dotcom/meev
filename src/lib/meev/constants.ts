// ============================================================
// MEEV — Platform constants (shared frontend + backend)
// ============================================================

// --------------- XP rules (v16: the studied economy) ---------------
// Levels come ONLY from real site interaction over time:
//   every 1 active hour = 1 point · every 24 points = 1 level.
// No XP for messages, gifts, spins, games, posts or logins — a level
// can never be bought or farmed in a burst; it is pure time-in.
export const XP_PER_HOUR = 1 // 1 XP per active hour (spec)
export const XP_PER_LEVEL = 24 // 24 XP = level 1, 48 = level 2 (spec)
export const MAX_LEVEL = 999 // prestige cap (spec)
export const XP_TOTAL_FOR_MAX = XP_PER_LEVEL * MAX_LEVEL

// v16 hard-currency trickle (deliberately scarce):
//   1 Gold Meev per 6 COMPLETED active hours  (max ~4/day for the hardcore)
//   5 Gold Meev the moment a new level is reached (24 hours of interaction)
// Everything else comes from OTHER people (received gifts are credited in full).
export const COIN_TRICKLE_HOURS = 6
export const COIN_TRICKLE_AMOUNT = 1
export const LEVEL_UP_COIN_BONUS = 5

// v16 gifting rules (user spec): gifts live ONLY in private (DM) and live
// rooms — never on posts. Hard cap: 24 gifts per rolling 24 hours.
export const GIFT_DAILY_LIMIT = 24

export const MEEV_COOKIE = 'meev_rt'

export const PRESENCE = {
  online: { label: 'Online', color: '#22c55e', icon: '●' },
  busy: { label: 'Busy', color: '#ef4444', icon: '●' },
  dnd: { label: 'Do Not Disturb', color: '#f59e0b', icon: '🌙' }, // crescent as requested
  offline: { label: 'Offline', color: '#6b7280', icon: '○' },
} as const

export type PresenceKey = keyof typeof PRESENCE

// --------------- Interests taxonomy ---------------
export const INTERESTS: { key: string; label: string; emoji: string }[] = [
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'anime', label: 'Anime & Manga', emoji: '🌸' },
  { key: 'music', label: 'Music', emoji: '🎧' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'programming', label: 'Programming', emoji: '💻' },
  { key: 'art', label: 'Drawing & Art', emoji: '🎨' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'movies', label: 'Movies & Series', emoji: '🎬' },
  { key: 'books', label: 'Books', emoji: '📚' },
  { key: 'cooking', label: 'Cooking', emoji: '🍳' },
  { key: 'photography', label: 'Photography', emoji: '📷' },
  { key: 'fashion', label: 'Fashion', emoji: '👕' },
  { key: 'fitness', label: 'Fitness', emoji: '💪' },
  { key: 'pets', label: 'Pets & Cats', emoji: '🐱' },
  { key: 'science', label: 'Science', emoji: '🔬' },
  { key: 'memes', label: 'Memes', emoji: '😂' },
  { key: 'crypto', label: 'Crypto & Tech', emoji: '🪙' },
  { key: 'cars', label: 'Cars', emoji: '🚗' },
]

// --------------- (v16: per-action XP is RETIRED) ---------------
// XP_REWARDS was removed on purpose: levels now come exclusively from the
// hourly interaction engine (XP_PER_HOUR / XP_PER_LEVEL above). Keeping a
// legacy map here invited accidental re-introduction of burst XP. The few
// call sites that still need the names (game text) hardcode their copy.

// --------------- Level unlocks (visual perks) — the v3 power ladder ---------------
// Level 1 → name colors · 3 → premium colors · 5 → animated gradient name ·
// 8 → shiny/chrome · 12 → neon glow · 20 → profile effects · 30 → animated covers ·
// 50 → mega glow · 999 → ANIMATED AVATAR + ANIMATED COVER (the big surprise)
export const LEVEL_UNLOCKS: { level: number; title: string; titleAr: string; desc: string; descAr: string }[] = [
  { level: 1, title: 'Name Colors', titleAr: 'ألوان الاسم', desc: 'Pick a color for your username from the starter palette', descAr: 'اختر لون اسمك من لوحة البداية' },
  { level: 3, title: 'Premium Colors', titleAr: 'ألوان مميزة', desc: 'Shiny gold + premium name colors in the shop', descAr: 'الذهب اللامع وألوان مميزة في المتجر' },
  { level: 5, title: 'Animated Username', titleAr: 'اسم متدرج متحرك', desc: 'Shimmering gradient animation on your display name', descAr: 'تدرج لوني متحرك على اسمك' },
  { level: 8, title: 'Chrome Shine', titleAr: 'لمعان كروم', desc: 'Glossy metallic shine effect on your name', descAr: 'تأثير معدني لامع على اسمك' },
  { level: 12, title: 'Neon Name', titleAr: 'اسم نيون', desc: 'Glowing neon tube username', descAr: 'اسم متوهج كأنبوب نيون' },
  { level: 20, title: 'Profile Effects', titleAr: 'تأثيرات البروفيل', desc: 'Living particle effects on your profile page', descAr: 'تأثيرات حية متحركة على صفحتك' },
  { level: 30, title: 'Animated Covers', titleAr: 'أغلفة متحركة', desc: 'Animated profile covers (aurora, lava, rainbow…)', descAr: 'أغلفة بروفايل متحركة (شفق، بركان، قوس قزح…)' },
  { level: 50, title: 'Mega Glow', titleAr: 'توهج خارق', desc: 'Intense multi-color aura on your avatar everywhere', descAr: 'هالة متعددة الألوان حول صورتك في كل مكان' },
  { level: 100, title: 'Legend Tier', titleAr: 'طبقة الأسطورة', desc: 'The rarest colors and effects only legends wear', descAr: 'أندر الألوان والتأثيرات للأساطير فقط' },
  { level: 999, title: '⚡ THE SURPRISE ⚡', titleAr: '⚡ المفاجأة الكبرى ⚡', desc: 'ANIMATED avatar + LEGEND cover + CUSTOM cover photo — the ultimate Meev flex', descAr: 'صورة بروفايل متحركة + غلاف الأسطورة + صورة غلاف خاصة بك — أقوى فليكس في ميف' },
]

export function unlockForLevel(level: number) {
  return LEVEL_UNLOCKS.filter((u) => u.level <= level)
}

// --------------- Name color palette (unlocked at level 1+) ---------------
// v3 progressive gating (edit dialog): first 4 → level 1 · next 3 → level 5 ·
// last 3 → level 20 (10 non-empty colors). Fancier effects live in the shop.
export const NAME_COLORS = [
  '', '#f43f5e', '#f59e0b', '#22c55e', '#14b8a6', '#a855f7', '#ec4899', '#eab308', '#f97316', '#06b6d4', '#8b5cf6',
]

// --------------- Badges ---------------
export const BADGES: { key: string; name: string; description: string; icon: string; color: string; levelRequired: number }[] = [
  { key: 'founder', name: 'Founder', description: 'Joined during the founding era of Meev', icon: '🚀', color: '#f59e0b', levelRequired: 0 },
  { key: 'social-butterfly', name: 'Social Butterfly', description: 'Made 5+ friends on Meev', icon: '🦋', color: '#ff7e5f', levelRequired: 0 },
  { key: 'night-owl', name: 'Night Owl', description: 'Active in the deep hours of the night', icon: '🦉', color: '#f04a6e', levelRequired: 0 },
  { key: 'gifted', name: 'Gifted', description: 'Sent your first Meev gift', icon: '🎁', color: '#f43f5e', levelRequired: 0 },
  { key: 'lvl-10', name: 'Rising Star', description: 'Reached level 10', icon: '⭐', color: '#eab308', levelRequired: 10 },
  { key: 'lvl-50', name: 'Meev Veteran', description: 'Reached level 50', icon: '🏆', color: '#22c55e', levelRequired: 50 },
  { key: 'lvl-100', name: 'Centurion', description: 'Reached level 100', icon: '💎', color: '#06b6d4', levelRequired: 100 },
  { key: 'lvl-999', name: 'Meev Legend', description: 'The Prestige. Level 999.', icon: '👑', color: '#f59e0b', levelRequired: 999 },
]

// --------------- Gift catalog (Hala-style gifting) ---------------
export type GiftDef = {
  key: string; name: string; description: string; price: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'; mood: string; xpReward: number
  emoji?: string // v2: burst particle emoji for the explosion animation
  /** v11: the SUPPORT CINEMA burst kind — which creatures/effects fly out
   *  when the gift detonates (doves 🕊️, butterflies 🦋, cats 🐱, fireworks…).
   *  See support-cinema.tsx — missing/unknown → the classic radial burst. */
  burst?: string
}

export const GIFTS: GiftDef[] = [
  { key: 'fish', name: 'Fresh Fish', description: 'A classic. Every Meev cat loves it.', price: 10, rarity: 'common', mood: 'happy', xpReward: 2, emoji: '🐟', burst: 'fish' },
  { key: 'yarn', name: 'Yarn Ball', description: 'Endless fun, guaranteed.', price: 25, rarity: 'common', mood: 'playful', xpReward: 5, emoji: '🧶', burst: 'cats' },
  { key: 'milk', name: 'Warm Milk', description: 'Cozy vibes in a cup.', price: 40, rarity: 'common', mood: 'sleepy', xpReward: 8, emoji: '🥛', burst: 'cats' },
  { key: 'heart', name: 'Heart Bomb', description: 'Explodes into a shower of hearts. Kaboom 💘', price: 60, rarity: 'rare', mood: 'love', xpReward: 12, emoji: '💖', burst: 'hearts' },
  { key: 'cake', name: 'Birthday Cake', description: 'Sweet celebration, any day of the year.', price: 90, rarity: 'rare', mood: 'party', xpReward: 18, emoji: '🎂', burst: 'confetti' },
  { key: 'crown', name: 'Royal Crown', description: 'For someone truly regal.', price: 120, rarity: 'rare', mood: 'royal', xpReward: 20, emoji: '👑', burst: 'crown' },
  { key: 'star', name: 'Shooting Star', description: 'A wish that streaks across the sky.', price: 150, rarity: 'epic', mood: 'excited', xpReward: 25, emoji: '🌟', burst: 'stars' },
  { key: 'rocket', name: 'Meev Rocket', description: 'To the moon and beyond!', price: 200, rarity: 'rare', mood: 'excited', xpReward: 35, emoji: '🚀', burst: 'rocket' },
  { key: 'diamond', name: 'Ice Diamond', description: 'Frozen brilliance, ultra rare sparkle.', price: 300, rarity: 'epic', mood: 'shocked', xpReward: 50, emoji: '💎', burst: 'stars' },
  { key: 'galaxy', name: 'Galaxy Heart', description: 'A whole nebula of affection.', price: 350, rarity: 'epic', mood: 'love', xpReward: 60, emoji: '🌌', burst: 'galaxy' },
  { key: 'dragon', name: 'Night Dragon', description: 'The dragon guards your friendship. Forever.', price: 800, rarity: 'legendary', mood: 'legend', xpReward: 150, emoji: '🐉', burst: 'dragon' },
  { key: 'megameev', name: 'MEGA MEEV', description: 'The legendary golden cat. Full-screen takeover.', price: 500, rarity: 'legendary', mood: 'legend', xpReward: 100, emoji: '🐱', burst: 'megameev' },
  // ---- v8: TikTok-style gifts (the classics everyone knows) ----
  { key: 'rose', name: 'Rose', description: 'التقدمة الخالدة — بدأ بها الجميع. The timeless opener.', price: 5, rarity: 'common', mood: 'love', xpReward: 1, emoji: '🌹', burst: 'petals' },
  { key: 'fingerheart', name: 'Finger Heart', description: 'قلب صغير بحركة يد. A tiny heart, a big gesture.', price: 15, rarity: 'common', mood: 'love', xpReward: 3, emoji: '🫰', burst: 'hearts' },
  { key: 'icecream', name: 'Ice Cream', description: 'مثلجات ميف المثلجة. Meev-chilled sweetness.', price: 30, rarity: 'common', mood: 'happy', xpReward: 6, emoji: '🍦', burst: 'confetti' },
  { key: 'donut', name: 'Donut', description: 'دونات سكرية مع رشّة حب. Sugary ring with a sprinkle of love.', price: 75, rarity: 'rare', mood: 'party', xpReward: 15, emoji: '🍩', burst: 'confetti' },
  { key: 'moneygun', name: 'Money Gun', description: 'أمطار من العملات الذهبية 💸. It rains Gold Meev.', price: 260, rarity: 'epic', mood: 'excited', xpReward: 45, emoji: '💸', burst: 'coins' },
  { key: 'phoenix', name: 'Phoenix', description: 'الطائر الذي لا يخبو — هدية العظماء. The undying flame of legends.', price: 1000, rarity: 'legendary', mood: 'legend', xpReward: 180, emoji: '🔥', burst: 'phoenix' },
  // ---- v11: SUPPORT gifts (TikTok/Hala-style) — the box EXPLODES and
  // creatures fly out over the whole screen (doves, butterflies, cats,
  // fireworks, meteors, petals, rainbows) — never a plain message ----
  { key: 'dove', name: 'Peace Dove', description: '🕊️ تخرج حمامات بيضاء من الصندوق وتحلّق. A white dove rises from the box and takes flight.', price: 8, rarity: 'common', mood: 'love', xpReward: 2, emoji: '🕊️', burst: 'doves' },
  { key: 'butterflies', name: 'Joy Butterflies', description: '🦋 فراشات ملونة تتطاير حولك. A swarm of butterflies flutters around you.', price: 20, rarity: 'common', mood: 'happy', xpReward: 4, emoji: '🦋', burst: 'butterflies' },
  { key: 'meevkitten', name: 'Meev Kitten', description: '🐱 قطط ميف تقفز من الهدية! Meev kittens leap out of the box!', price: 35, rarity: 'common', mood: 'playful', xpReward: 7, emoji: '🐱', burst: 'cats' },
  { key: 'bouquet', name: 'Rose Bouquet', description: '💐 وابل من الورد يتناثر كالمطر. A rain of scattered rose petals.', price: 55, rarity: 'rare', mood: 'love', xpReward: 11, emoji: '💐', burst: 'petals' },
  { key: 'doveflock', name: 'Dove Flock', description: '🕊️ سرب كامل من الحمام يملأ الشاشة. An entire flock fills the sky.', price: 90, rarity: 'rare', mood: 'legend', xpReward: 18, emoji: '🕊️', burst: 'doveflock' },
  { key: 'fireworks', name: 'Fireworks Show', description: '🎆 عرض ألعاب نارية كامل فوق رأسك. A full fireworks show above your head.', price: 140, rarity: 'rare', mood: 'party', xpReward: 25, emoji: '🎆', burst: 'fireworks' },
  { key: 'meteorshower', name: 'Meteor Shower', description: '🌠 وابل شهب يعبر السماء كله مرة واحدة. A meteor shower streaks across the whole sky.', price: 220, rarity: 'epic', mood: 'excited', xpReward: 38, emoji: '🌠', burst: 'meteors' },
  { key: 'rainbowarc', name: 'Rainbow Arc', description: '🌈 قوس قزح كامل يرسم نفسه عبر الشاشة. A full rainbow paints itself across the screen.', price: 300, rarity: 'epic', mood: 'love', xpReward: 50, emoji: '🌈', burst: 'rainbow' },
]

export const RARITY_STYLES: Record<string, { ring: string; glow: string; label: string }> = {
  common: { ring: '#64748b', glow: 'rgba(100,116,139,.5)', label: 'Common' },
  rare: { ring: '#06b6d4', glow: 'rgba(6,182,212,.5)', label: 'Rare' },
  epic: { ring: '#ff7e5f', glow: 'rgba(255,126,95,.55)', label: 'Epic' },
  legendary: { ring: '#f59e0b', glow: 'rgba(245,158,11,.6)', label: 'Legendary' },
}

// --------------- Sticker set (MeevCat moods) ---------------
export const STICKERS: { key: string; mood: string; label: string }[] = [
  { key: 'mochi', mood: 'happy', label: 'Mochi' },
  { key: 'blep', mood: 'blep', label: 'Blep' },
  { key: 'sleepy', mood: 'sleepy', label: 'Sleepy' },
  { key: 'love', mood: 'love', label: 'In Love' },
  { key: 'shock', mood: 'shocked', label: 'Shook' },
  { key: 'party', mood: 'party', label: 'Party' },
  { key: 'sad', mood: 'sad', label: 'Sad' },
  { key: 'angry', mood: 'angry', label: 'Grumpy' },
  { key: 'nyan', mood: 'nyan', label: 'Nyan' },
]

// --------------- Story gradients for text stories ---------------
export const STORY_GRADIENTS: Record<string, string> = {
  sunset: 'linear-gradient(135deg,#ffc24d,#ff7e5f,#f04a6e)',
  ocean: 'linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899)',
  forest: 'linear-gradient(135deg,#22c55e,#14b8a6,#0ea5e9)',
  lava: 'linear-gradient(135deg,#f43f5e,#f97316,#eab308)',
  candy: 'linear-gradient(135deg,#ec4899,#f472b6,#fda4af)',
  midnight: 'linear-gradient(135deg,#1e1b4b,#7c3aed,#a855f7)',
  neon: 'linear-gradient(135deg,#a855f7,#ec4899,#f59e0b)',
}

// --------------- v11: PULSE VIBES (نبض) ----------------
// The stories system became **Meev Pulse**: every pulse carries a VIBE —
// the vibe paints the rail's living ring in its own hue, drives the cinema's
// ambient particles, and stamps a mood chip on the composer + viewer.
// The vibe RIDES the existing gradient field (one vibe per gradient) so no
// schema change was needed.
export type PulseVibe = {
  key: string
  emoji: string
  gradient: string
  hue: string
  particles: string[]
  label: string
  labelAr: string
}

export const PULSE_VIBES: PulseVibe[] = [
  { key: 'sunset', emoji: '🥰', gradient: 'sunset', hue: '#f43f5e', particles: ['✨', '💫', '❤️', '🌟', '⭐', '✦'], label: 'Love', labelAr: 'حب' },
  { key: 'candy', emoji: '😄', gradient: 'candy', hue: '#ec4899', particles: ['✨', '⭐', '🎉', '💫'], label: 'Happy', labelAr: 'سعيد' },
  { key: 'neon', emoji: '🤩', gradient: 'neon', hue: '#a855f7', particles: ['⚡', '🔥', '💫', '✦'], label: 'Hype', labelAr: 'حماس' },
  { key: 'ocean', emoji: '😌', gradient: 'ocean', hue: '#06b6d4', particles: ['🫧', '🌊', '💤', '☁️'], label: 'Chill', labelAr: 'هادئ' },
  { key: 'forest', emoji: '🌱', gradient: 'forest', hue: '#22c55e', particles: ['🍃', '🌿', '🍀', '✨'], label: 'Fresh', labelAr: 'منتعش' },
  { key: 'lava', emoji: '⚡', gradient: 'lava', hue: '#f97316', particles: ['🔥', '⚡', '👑', '✨'], label: 'Legend', labelAr: 'أسطوري' },
  { key: 'midnight', emoji: '🎭', gradient: 'midnight', hue: '#7c3aed', particles: ['🌙', '🔮', '✦', '💜'], label: 'Mystery', labelAr: 'غامض' },
]

export function vibeOf(gradient?: string | null): PulseVibe | null {
  if (!gradient) return null
  return PULSE_VIBES.find((v) => v.key === gradient) ?? null
}

// --------------- Report reasons ---------------
export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'nsfw', label: 'Inappropriate content' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'other', label: 'Something else' },
]

// --------------- MeevCat avatar palette (deterministic from seed) ---------------
export const CAT_PALETTE: Record<string, { fur: string; fur2: string; ear: string; eye: string; nose: string }> = {
  midnight: { fur: '#1f2937', fur2: '#111827', ear: '#374151', eye: '#fbbf24', nose: '#f472b6' },
  mochi: { fur: '#fde3d3', fur2: '#fbc4ac', ear: '#f9a885', eye: '#7c3aed', nose: '#f472b6' },
  shadow: { fur: '#3f3f46', fur2: '#27272a', ear: '#52525b', eye: '#22d3ee', nose: '#fb7185' },
  honey: { fur: '#fbbf24', fur2: '#f59e0b', ear: '#d97706', eye: '#0f172a', nose: '#f43f5e' },
  cherry: { fur: '#f43f5e', fur2: '#e11d48', ear: '#be123c', eye: '#ffffff', nose: '#fde68a' },
  mint: { fur: '#99f6e4', fur2: '#5eead4', ear: '#2dd4bf', eye: '#0f172a', nose: '#f472b6' },
  lavender: { fur: '#ddd6fe', fur2: '#c4b5fd', ear: '#a78bfa', eye: '#7c3aed', nose: '#fb7185' },
  cloud: { fur: '#f8fafc', fur2: '#e2e8f0', ear: '#cbd5e1', eye: '#0ea5e9', nose: '#f472b6' },
}

export const AVATAR_GRADIENTS: Record<string, string> = {
  sunset: 'linear-gradient(135deg,#f59e0b,#ec4899)',
  violet: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  teal: 'linear-gradient(135deg,#14b8a6,#06b6d4)',
  rose: 'linear-gradient(135deg,#f43f5e,#f97316)',
  forest: 'linear-gradient(135deg,#22c55e,#84cc16)',
  gold: 'linear-gradient(135deg,#eab308,#f97316)',
  slate: 'linear-gradient(135deg,#475569,#94a3b8)',
  ocean: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)',
}

export const MEEV_BOT_ID = 'meevbot'
export const MEEV_BOT_USERNAME = 'meevbot'

// ============================================================
// v2 — PawCoins economy, shop cosmetics, emoji stickers, games
// ============================================================

// --------------- Currency (v4: Gold Meev 🪙 — the official golden currency) ---------------
export const CURRENCY = { name: 'Gold Meev', nameAr: 'ذهب ميف', emoji: '🪙', icon: '/meev-coin-cat.png' } as const
export const SPIN_COOLDOWN_HOURS = 168 // v3: weekly spin (economy protection)
export const SPIN_MAX_COINS = 5 // v3: hard prize cap per week

// --------------- Emoji sticker packs (chat sticker picker, tab 2) ---------------
export const EMOJI_STICKER_SETS: { key: string; label: string; labelAr: string; emojis: string[] }[] = [
  {
    key: 'faces', label: 'Faces', labelAr: 'وجوه',
    emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😭', '😡', '🤯', '😴', '🤗', '🫶', '🫡', '🤔', '🙃'],
  },
  {
    key: 'cats', label: 'Cats', labelAr: 'قطط',
    emojis: ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐾', '🐈'],
  },
  {
    key: 'fun', label: 'Fun', labelAr: 'مرح',
    emojis: ['❤️', '🔥', '✨', '🎉', '💜', '⭐', '🍀', '🌙', '🌈', '🍩', '🍕', '🎮'],
  },
]

// --------------- Shop catalog (v3) ---------------
export type ShopType = 'name_gradient' | 'name_color' | 'name_effect' | 'frame' | 'badge' | 'accessory' | 'profile_effect' | 'cover' | 'animated_avatar'

export type ShopItemDef = {
  key: string
  type: ShopType
  name: string
  nameAr?: string
  description: string
  descriptionAr?: string
  price: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  payload: Record<string, unknown> // {gradient, animated} | {ring, colors} | {icon, color} | {acc}
  levelRequired: number
  xpReward: number
}

export const SHOP_ITEMS: ShopItemDef[] = [
  // ---- name gradients (purchasable, any level — the level-5 aurora stays free) ----
  { key: 'ng-mint', type: 'name_gradient', name: 'Mint Fresh', nameAr: 'نعناعي', description: 'Cool minty username gradient', descriptionAr: 'تدرج اسم نعناعي منعش', price: 250, rarity: 'common', payload: { gradient: 'linear-gradient(90deg,#22c55e,#14b8a6)' }, levelRequired: 0, xpReward: 10 },
  { key: 'ng-sunset', type: 'name_gradient', name: 'Aurora Sunset', nameAr: 'غروب', description: 'Golden sunset melting into rose', descriptionAr: 'غروب ذهبي يذوب إلى وردٍ دافئ', price: 300, rarity: 'rare', payload: { gradient: 'linear-gradient(90deg,#ffc24d,#ff7e5f,#f04a6e)' }, levelRequired: 0, xpReward: 12 },
  { key: 'ng-candy', type: 'name_gradient', name: 'Candy Rush', nameAr: 'حلوى', description: 'Sweet bubblegum energy', descriptionAr: 'طاقة علكة حلوة', price: 350, rarity: 'rare', payload: { gradient: 'linear-gradient(90deg,#ec4899,#f472b6,#fda4af)' }, levelRequired: 0, xpReward: 14 },
  { key: 'ng-ocean', type: 'name_gradient', name: 'Ocean Glow', nameAr: 'محيط', description: 'Deep teal shimmering waves', descriptionAr: 'أمواج فيروزية متلألئة', price: 450, rarity: 'epic', payload: { gradient: 'linear-gradient(90deg,#06b6d4,#8b5cf6)' }, levelRequired: 3, xpReward: 18 },
  { key: 'ng-neon', type: 'name_gradient', name: 'Neon Nights', nameAr: 'نيون', description: 'Animated neon city lights', descriptionAr: 'أضواء نيون متحركة', price: 600, rarity: 'epic', payload: { gradient: 'linear-gradient(90deg,#a855f7,#ec4899,#f59e0b,#a855f7)', animated: true }, levelRequired: 5, xpReward: 22 },
  { key: 'ng-fire', type: 'name_gradient', name: 'Inferno', nameAr: 'جحيم', description: 'Blazing fire text, animated', descriptionAr: 'اسم ناري متحرك', price: 700, rarity: 'epic', payload: { gradient: 'linear-gradient(90deg,#f43f5e,#f97316,#eab308,#f43f5e)', animated: true }, levelRequired: 8, xpReward: 25 },
  { key: 'ng-gold', type: 'name_gradient', name: 'Pure Gold', nameAr: 'ذهب خالص', description: '24k flex on everyone', descriptionAr: 'ذهب ٢٤ قيراط', price: 900, rarity: 'legendary', payload: { gradient: 'linear-gradient(90deg,#eab308,#f59e0b,#fde68a,#eab308)', animated: true }, levelRequired: 10, xpReward: 30 },
  { key: 'ng-rainbow', type: 'name_gradient', name: 'Rainbow Legend', nameAr: 'قوس قزح', description: 'Full rainbow cycle — legendary', descriptionAr: 'قوس قزح كامل متحرك', price: 1500, rarity: 'legendary', payload: { gradient: 'linear-gradient(90deg,#f43f5e,#f97316,#eab308,#22c55e,#06b6d4,#a855f7,#ec4899,#f43f5e)', animated: true }, levelRequired: 15, xpReward: 40 },

  // ---- avatar frames ----
  { key: 'fr-aura', type: 'frame', name: 'Aura Glow', nameAr: 'هالة', description: 'A soft living aura around your avatar', descriptionAr: 'هالة ناعمة حول صورتك', price: 200, rarity: 'common', payload: { ring: 'aura', colors: ['#ff7e5f', '#f04a6e'] }, levelRequired: 0, xpReward: 8 },
  { key: 'fr-fire', type: 'frame', name: 'Fire Ring', nameAr: 'حلقة نار', description: 'Blazing ring of flames', descriptionAr: 'حلقة من اللهب', price: 400, rarity: 'rare', payload: { ring: 'spin', colors: ['#f43f5e', '#f97316', '#eab308'] }, levelRequired: 0, xpReward: 15 },
  { key: 'fr-frost', type: 'frame', name: 'Frost Ring', nameAr: 'حلقة جليد', description: 'Frozen sparkle ring', descriptionAr: 'حلقة جليدية متلألئة', price: 400, rarity: 'rare', payload: { ring: 'spin', colors: ['#22d3ee', '#a5f3fc', '#06b6d4'] }, levelRequired: 0, xpReward: 15 },
  { key: 'fr-hearts', type: 'frame', name: 'Heartbeat', nameAr: 'دقات قلب', description: 'Pulsing hearts ring', descriptionAr: 'قلوب تنبض حول صورتك', price: 600, rarity: 'epic', payload: { ring: 'pulse', colors: ['#f43f5e', '#fb7185'] }, levelRequired: 3, xpReward: 20 },
  { key: 'fr-rainbow', type: 'frame', name: 'Rainbow Spin', nameAr: 'قوس قزح دوّار', description: 'Animated rainbow conic ring', descriptionAr: 'حلقة قوس قزح دوّارة', price: 800, rarity: 'epic', payload: { ring: 'spin', colors: ['#f59e0b', '#ec4899', '#a855f7', '#06b6d4', '#22c55e', '#f59e0b'] }, levelRequired: 5, xpReward: 25 },
  { key: 'fr-galaxy', type: 'frame', name: 'Galaxy Halo', nameAr: 'هالة المجرة', description: 'A legendary galaxy orbits your face', descriptionAr: 'مجرة تدور حول وجهك', price: 1200, rarity: 'legendary', payload: { ring: 'galaxy', colors: ['#a855f7', '#ec4899', '#f59e0b', '#06b6d4'] }, levelRequired: 10, xpReward: 35 },

  // ---- v12: PREMIUM avatar frames (user: "زيد اطارات صور ببعملات كثيرة
  // ولفلات عالية تكون جميلة") — a luxury tier above everything: thousands
  // of Gold Meev, gates at 25/50/100/200/350/500/999. Warm MEEV DAWN tokens
  // (honey/coral/rose + deep golds) only. Rendered by cat-avatar.tsx ----
  { key: 'fr-phoenix', type: 'frame', name: 'Phoenix Flame', nameAr: 'فينكس', description: 'A living ring of flames with a roaming fire tongue', descriptionAr: 'حلقة لهب حيّة يلفّها لسان نارٍ دوّار — فئة فل ٢٥', price: 2500, rarity: 'epic', payload: { ring: 'phoenix', colors: ['#ff9d5c', '#ffc24d', '#f04a6e'] }, levelRequired: 25, xpReward: 60 },
  { key: 'fr-prism', type: 'frame', name: 'Prism Light', nameAr: 'بريزم', description: 'Light split through glass — hue-cycling double ring', descriptionAr: 'ضوءٌ ينكسر عبر الزجاج — حلقتان بألوانٍ دوّارة — فئة فل ٥٠', price: 3500, rarity: 'legendary', payload: { ring: 'prism', colors: ['#ffc24d', '#ff7e5f', '#f04a6e'] }, levelRequired: 50, xpReward: 80 },
  { key: 'fr-orbit', type: 'frame', name: 'Orbit Worlds', nameAr: 'مدار', description: 'Three tiny planets orbit your avatar on living paths', descriptionAr: 'ثلاثة كواكب صغيرة تدور حول صورتك في مداراتٍ حيّة — فئة فل ١٠٠', price: 5000, rarity: 'legendary', payload: { ring: 'orbit', colors: ['#fbbf24', '#f04a6e', '#ffc24d'] }, levelRequired: 100, xpReward: 110 },
  { key: 'fr-diamond', type: 'frame', name: 'Faceted Diamond', nameAr: 'ألماسة', description: 'Faceted brilliance with a travelling sparkle', descriptionAr: 'بريقٌ ألماسي مُصقول تعبره لمعاتٌ جوّالة — فئة فل ٢٠٠', price: 7500, rarity: 'legendary', payload: { ring: 'diamond', colors: ['#ffc24d', '#ffe4a8'] }, levelRequired: 200, xpReward: 150 },
  { key: 'fr-aurum', type: 'frame', name: 'Aurum 24k', nameAr: 'أوروم', description: 'Pure 24k gold double ring with a shimmer sweep', descriptionAr: 'حلقة ذهبٍ خالص ٢٤ قيراط بلمعةٍ منسابة — فئة فل ٣٥٠', price: 12000, rarity: 'legendary', payload: { ring: 'legend-gold', colors: ['#fde68a', '#fbbf24', '#b45309'] }, levelRequired: 350, xpReward: 200 },
  { key: 'fr-eclipse', type: 'frame', name: 'Eclipse Corona', nameAr: 'كسوف', description: 'A dark eclipse with a slowly rotating glowing corona', descriptionAr: 'كسوفٌ مهيب بإكليلٍ متوهّج يدور ببطء — فئة فل ٥٠٠', price: 20000, rarity: 'legendary', payload: { ring: 'eclipse', colors: ['#f04a6e', '#ffd9a0'] }, levelRequired: 500, xpReward: 260 },
  { key: 'fr-meev999', type: 'frame', name: '⚡ MEEV 999 ⚡', nameAr: 'أسطورة ٩٩٩', description: 'The crown jewel — 24k gold ring, orbiting golden paws and a living shimmer. Level 999 only', descriptionAr: 'جوهرة التاج — ذهب ٢٤ قيراط + مكّاتٌ ذهبية دوّارة + لمعانٌ حيّ. حصرياً لفل ٩٩٩', price: 50000, rarity: 'legendary', payload: { ring: 'meev999', colors: ['#fde68a', '#fbbf24', '#b45309'] }, levelRequired: 999, xpReward: 999 },

  // ---- badges (profile flex) ----
  { key: 'bd-rose', type: 'badge', name: 'Rose Badge', nameAr: 'وردة', description: 'A rose next to your name', descriptionAr: 'وردة بجانب اسمك', price: 200, rarity: 'common', payload: { icon: '🌹', color: '#f43f5e' }, levelRequired: 0, xpReward: 8 },
  { key: 'bd-rock', type: 'badge', name: 'Rocker', nameAr: 'روكر', description: 'Rock on!', descriptionAr: 'روك أند رول!', price: 250, rarity: 'common', payload: { icon: '🎸', color: '#f97316' }, levelRequired: 0, xpReward: 10 },
  { key: 'bd-ghost', type: 'badge', name: 'Ghost', nameAr: 'شبح', description: 'Spooky but friendly', descriptionAr: 'مرعب لكنه ودود', price: 300, rarity: 'rare', payload: { icon: '👻', color: '#a5f3fc' }, levelRequired: 0, xpReward: 12 },
  { key: 'bd-star', type: 'badge', name: 'Super Star', nameAr: 'سوبر ستار', description: 'A shooting star badge', descriptionAr: 'نجمة شهاب', price: 350, rarity: 'rare', payload: { icon: '⭐', color: '#eab308' }, levelRequired: 3, xpReward: 14 },
  { key: 'bd-diamond', type: 'badge', name: 'Diamond Supporter', nameAr: 'داعم ماسي', description: 'Supporter of the realm', descriptionAr: 'داعم من عالم ميف', price: 500, rarity: 'epic', payload: { icon: '💎', color: '#22d3ee' }, levelRequired: 5, xpReward: 20 },
  { key: 'bd-crown', type: 'badge', name: 'Royalty', nameAr: 'ملكي', description: 'Certified royalty', descriptionAr: 'ملك معتمد', price: 1000, rarity: 'legendary', payload: { icon: '👑', color: '#f59e0b' }, levelRequired: 10, xpReward: 30 },

  // ---- cat accessories (hats on the MeevCat) ----
  { key: 'ac-flower', type: 'accessory', name: 'Flower', nameAr: 'زهرة', description: 'A cute flower behind the ear', descriptionAr: 'زهرة لطيفة خلف الأذن', price: 100, rarity: 'common', payload: { acc: 'flower' }, levelRequired: 0, xpReward: 5 },
  { key: 'ac-party', type: 'accessory', name: 'Party Hat', nameAr: 'قبعة حفلة', description: 'Always celebrating', descriptionAr: 'دائم الاحتفال', price: 150, rarity: 'common', payload: { acc: 'party' }, levelRequired: 0, xpReward: 6 },
  { key: 'ac-headphones', type: 'accessory', name: 'Headphones', nameAr: 'سماعات', description: 'Lo-fi beats, all day', descriptionAr: 'أغاني لوفاي طول اليوم', price: 300, rarity: 'rare', payload: { acc: 'headphones' }, levelRequired: 0, xpReward: 12 },
  { key: 'ac-wizard', type: 'accessory', name: 'Wizard Hat', nameAr: 'قبعة ساحر', description: 'Meowgical powers', descriptionAr: 'قوى سحرية مووو', price: 400, rarity: 'rare', payload: { acc: 'wizard' }, levelRequired: 3, xpReward: 15 },
  { key: 'ac-crown', type: 'accessory', name: 'Golden Crown', nameAr: 'تاج ذهبي', description: 'The cat king has arrived', descriptionAr: 'وصل ملك القطط', price: 500, rarity: 'epic', payload: { acc: 'crown' }, levelRequired: 5, xpReward: 20 },
  { key: 'ac-halo', type: 'accessory', name: 'Angel Halo', nameAr: 'هالة ملاك', description: 'Pure heart certified', descriptionAr: 'قلب طاهر معتمد', price: 700, rarity: 'epic', payload: { acc: 'halo' }, levelRequired: 8, xpReward: 25 },

  // ---- premium name colors (v3 — progressive level unlocks) ----
  { key: 'nc-rose', type: 'name_color', name: 'Deep Rose', nameAr: 'وِرد عميق', description: 'A rich rose name color', descriptionAr: 'لون وردي عميق لاسمك', price: 120, rarity: 'common', payload: { color: '#fb7185' }, levelRequired: 1, xpReward: 6 },
  { key: 'nc-gold', type: 'name_color', name: 'Shiny Gold', nameAr: 'ذهب لامع', description: '✨ 24k glossy gold username', descriptionAr: '✨ اسم ذهبي لامع ٢٤ قيراط', price: 450, rarity: 'rare', payload: { color: '#fde047', shine: true }, levelRequired: 3, xpReward: 15 },
  { key: 'nc-chrome', type: 'name_color', name: 'Chrome', nameAr: 'كروم', description: 'Glossy metallic silver shine', descriptionAr: 'لمعان فضي معدني', price: 800, rarity: 'epic', payload: { color: '#e2e8f0', shine: true }, levelRequired: 8, xpReward: 25 },
  { key: 'nc-neon', type: 'name_color', name: 'Neon Tube', nameAr: 'نيون', description: 'Glowing neon tube username', descriptionAr: 'اسم متوهج كنيون', price: 1100, rarity: 'epic', payload: { color: '#22d3ee', neon: true }, levelRequired: 12, xpReward: 30 },
  { key: 'nc-lava', type: 'name_color', name: 'Lava', nameAr: 'حمم', description: 'Molten lava glow name', descriptionAr: 'اسم متوهج كالحمم', price: 1400, rarity: 'legendary', payload: { color: '#f97316', neon: true }, levelRequired: 20, xpReward: 35 },
  { key: 'nc-rainbow', type: 'name_color', name: 'Rainbow Solid', nameAr: 'قوس قزح صلب', description: 'Full rainbow hue cycling name', descriptionAr: 'اسم يدور بألوان قوس قزح', price: 2500, rarity: 'legendary', payload: { color: '', rainbow: true }, levelRequired: 100, xpReward: 50 },
  // ---- v11: MORE name colors (user: "كثير الوان الاسم") ----
  { key: 'nc-bloom', type: 'name_color', name: 'Sakura Bloom', nameAr: 'أزهار الكرز', description: '🌸 soft pink spring petals', descriptionAr: '🌸 وردة ربيعية وردية ناعمة', price: 220, rarity: 'rare', payload: { color: '#f9a8d4', shine: true }, levelRequired: 1, xpReward: 9 },
  { key: 'nc-viper', type: 'name_color', name: 'Viper Green', nameAr: 'أخضر سام', description: '🐍 neon venom green', descriptionAr: '🐍 أخضر سام نيوني', price: 600, rarity: 'epic', payload: { color: '#84cc16', neon: true }, levelRequired: 8, xpReward: 22 },
  { key: 'nc-mint', type: 'name_color', name: 'Mint Cream', nameAr: 'نعناع كريمي', description: '🌿 fresh minty shine', descriptionAr: '🌿 لمعان نعناعي منعش', price: 380, rarity: 'rare', payload: { color: '#34d399', shine: true }, levelRequired: 3, xpReward: 13 },
  { key: 'nc-blaze', type: 'name_color', name: 'Blaze', nameAr: 'لهيب', description: '🔥 blazing amber shine', descriptionAr: '🔥 لمعان كهرماني ملتهب', price: 520, rarity: 'rare', payload: { color: '#fb923c', shine: true }, levelRequired: 5, xpReward: 16 },
  { key: 'nc-royal', type: 'name_color', name: 'Royal Violet', nameAr: 'بنفسجي ملكي', description: '👑 deep royal violet glow', descriptionAr: '👑 توهج بنفسجي ملكي عميق', price: 750, rarity: 'epic', payload: { color: '#a78bfa', shine: true }, levelRequired: 8, xpReward: 24 },
  { key: 'nc-frost', type: 'name_color', name: 'Frost', nameAr: 'جليد', description: '❄️ ice-white frosty shine', descriptionAr: '❄️ لمعان جليدي أبيض', price: 850, rarity: 'epic', payload: { color: '#e0f2fe', shine: true }, levelRequired: 12, xpReward: 26 },
  { key: 'nc-candy', type: 'name_color', name: 'Candy Floss', nameAr: 'قطن حلوى', description: '🍬 sweet candy pink', descriptionAr: '🍬 وردي قطن الحلوى', price: 260, rarity: 'rare', payload: { color: '#f472b6', shine: true }, levelRequired: 1, xpReward: 10 },

  // ---- v11: NAME EFFECTS (user: "اشكال اسم افكتات جديدة") — a whole new
  // cosmetic SLOT (User.nameFx): wave / glitch / flicker / fire / holo /
  // sparkle / chrome3d / heartbeat. Rendered by username.tsx ----
  { key: 'nf-wave', type: 'name_effect', name: 'Wave Bounce', nameAr: 'موجة راقصة', description: 'Every letter of your name dances in a wave', descriptionAr: 'كل حرف من اسمك يرقص كموجة', price: 300, rarity: 'rare', payload: { fx: 'wave' }, levelRequired: 3, xpReward: 12 },
  { key: 'nf-heartbeat', type: 'name_effect', name: 'Heartbeat', nameAr: 'نبض القلب', description: 'Your name pulses like a beating heart', descriptionAr: 'اسمك ينبض كقلب يخفق', price: 400, rarity: 'rare', payload: { fx: 'heartbeat' }, levelRequired: 4, xpReward: 14 },
  { key: 'nf-flicker', type: 'name_effect', name: 'Candle Flicker', nameAr: 'وميض شمعة', description: 'A candle-flame flicker on your name', descriptionAr: 'وميض شمعة يتراقص على اسمك', price: 350, rarity: 'rare', payload: { fx: 'flicker' }, levelRequired: 5, xpReward: 12 },
  { key: 'nf-sparkle', type: 'name_effect', name: 'Sparkle Trail', nameAr: 'أثر البريق', description: '✨ twinkling sparkles live inside your name', descriptionAr: '✨ بريق يتلألأ داخل اسمك', price: 500, rarity: 'rare', payload: { fx: 'sparkle' }, levelRequired: 6, xpReward: 16 },
  { key: 'nf-glitch', type: 'name_effect', name: 'Glitch', nameAr: 'جليتش', description: 'Cyberpunk RGB-split glitching', descriptionAr: 'تشويش جليتش بألوان منفصلة', price: 450, rarity: 'epic', payload: { fx: 'glitch' }, levelRequired: 8, xpReward: 18 },
  { key: 'nf-fire', type: 'name_effect', name: 'Fire Name', nameAr: 'اسم ناري', description: '🔥 burning letters with rising heat', descriptionAr: '🔥 حروف مشتعلة بحرارة صاعدة', price: 600, rarity: 'epic', payload: { fx: 'fire' }, levelRequired: 10, xpReward: 20 },
  { key: 'nf-holo', type: 'name_effect', name: 'Hologram', nameAr: 'هولوغرام', description: 'Iridescent holographic shimmer sweep', descriptionAr: 'لمعان هولوغرافي قزحي ينساب', price: 800, rarity: 'epic', payload: { fx: 'holo' }, levelRequired: 15, xpReward: 24 },
  { key: 'nf-chrome3d', type: 'name_effect', name: '3D Chrome', nameAr: 'كروم ثلاثي', description: 'Extruded 3D chrome with a moving highlight', descriptionAr: 'كروم بارز ثلاثي الأبعاد بلمعة متحركة', price: 1000, rarity: 'legendary', payload: { fx: 'chrome3d' }, levelRequired: 20, xpReward: 30 },

  // ---- profile effects (v3 — living particles on the profile hero) ----
  { key: 'pe-aurora', type: 'profile_effect', name: 'Aurora Waves', nameAr: 'أمواج الشفق', description: 'Northern lights drifting behind your profile', descriptionAr: 'شفق قطبي ينساب خلف بروفايلك', price: 350, rarity: 'rare', payload: { effect: 'aurora' }, levelRequired: 5, xpReward: 12 },
  { key: 'pe-hearts', type: 'profile_effect', name: 'Heart Rain', nameAr: 'مطر قلوب', description: 'Hearts float up your profile', descriptionAr: 'قلوب تصعد على صفحتك', price: 500, rarity: 'rare', payload: { effect: 'hearts' }, levelRequired: 10, xpReward: 18 },
  { key: 'pe-fire', type: 'profile_effect', name: 'Fire Aura', nameAr: 'هالة نارية', description: 'Embers and flames around your cover', descriptionAr: 'جمر ونار حول غلافك', price: 700, rarity: 'epic', payload: { effect: 'fire' }, levelRequired: 15, xpReward: 22 },
  { key: 'pe-snow', type: 'profile_effect', name: 'Snowfall', nameAr: 'تساقط ثلج', description: 'Gentle snowflakes over your profile', descriptionAr: 'رقاقات ثلج تهبط على صفحتك', price: 600, rarity: 'rare', payload: { effect: 'snow' }, levelRequired: 15, xpReward: 20 },
  { key: 'pe-rainbow', type: 'profile_effect', name: 'Rainbow Border', nameAr: 'إطار قوس قزح', description: 'Animated rainbow border around your profile card', descriptionAr: 'إطار قوس قزح متحرك حول بطاقتك', price: 1200, rarity: 'legendary', payload: { effect: 'rainbow' }, levelRequired: 25, xpReward: 35 },
  { key: 'pe-galaxy', type: 'profile_effect', name: 'Galaxy Orbit', nameAr: 'مدار المجرة', description: 'Stars and planets orbit your profile', descriptionAr: 'نجوم وكواكب تدور حول صفحتك', price: 2000, rarity: 'legendary', payload: { effect: 'galaxy' }, levelRequired: 40, xpReward: 45 },

  // ---- profile covers (v3 — animated at higher tiers) ----
  { key: 'cv-aurora', type: 'cover', name: 'Aurora Cover', nameAr: 'غلاف الشفق', description: 'Animated northern lights cover', descriptionAr: 'غلاف شفق متوهج متحرك', price: 400, rarity: 'rare', payload: { cover: 'aurora' }, levelRequired: 3, xpReward: 14 },
  { key: 'cv-nebula', type: 'cover', name: 'Nebula Cover', nameAr: 'غلاف السديم', description: 'Deep-space nebula, slowly drifting', descriptionAr: 'سديم فضائي ينساب ببطء', price: 600, rarity: 'epic', payload: { cover: 'nebula' }, levelRequired: 8, xpReward: 20 },
  { key: 'cv-synthwave', type: 'cover', name: 'Synthwave', nameAr: 'سينث ويف', description: 'Retro neon grid sunset (animated)', descriptionAr: 'غروب نيون رترو متحرك', price: 900, rarity: 'epic', payload: { cover: 'synthwave' }, levelRequired: 12, xpReward: 28 },
  { key: 'cv-lava', type: 'cover', name: 'Lava Flow', nameAr: 'تدفق الحمم', description: 'Molten lava waves in motion', descriptionAr: 'أمواج حمم منصهرة متحركة', price: 1200, rarity: 'legendary', payload: { cover: 'lava' }, levelRequired: 20, xpReward: 35 },
  { key: 'cv-rainbow', type: 'cover', name: 'Rainbow Flow', nameAr: 'تدفق قوس قزح', description: 'Full-spectrum animated cover', descriptionAr: 'غلاف متحرك بكل ألوان الطيف', price: 1800, rarity: 'legendary', payload: { cover: 'rainbow' }, levelRequired: 30, xpReward: 45 },
  { key: 'cv-legend', type: 'cover', name: '⚡ LEGEND COVER ⚡', nameAr: '⚡ غلاف الأسطورة ⚡', description: 'The level-999 surprise — a living golden galaxy only Legends wear', descriptionAr: 'مفاجأة لفل ٩٩٩ — مجرة ذهبية حية يلبسها الأساطير فقط', price: 99, rarity: 'legendary', payload: { cover: 'legend' }, levelRequired: 999, xpReward: 99 },

  // ---- THE level-999 surprise: animated avatar ----
  { key: 'aa-legend', type: 'animated_avatar', name: '⚡ ANIMATED AVATAR ⚡', nameAr: '⚡ صورة متحركة ⚡', description: 'Level 999 exclusive — your avatar comes ALIVE (mood-cycling cat or living photo ring)', descriptionAr: 'حصري لفل ٩٩٩ — صورتك تنبض بالحياة (قطة تقلب مزاجها أو إطار حي لصورتك)', price: 99, rarity: 'legendary', payload: { anim: 'legend' }, levelRequired: 999, xpReward: 99 },

  // ---- badges v3 (Discord-style shelf, bought with MANY coins) ----
  { key: 'bd-activity', type: 'badge', name: 'Activity', nameAr: 'النشاط', description: 'Always-on energy, never sleeps', descriptionAr: 'طاقة لا تنام أبداً', price: 1200, rarity: 'rare', payload: { icon: '⚡', color: '#facc15' }, levelRequired: 5, xpReward: 25 },
  { key: 'bd-passion', type: 'badge', name: 'Passion', nameAr: 'شغف', description: 'The flame that keeps Meev alive', descriptionAr: 'الشعلة التي تبقي ميف حياً', price: 1800, rarity: 'epic', payload: { icon: '🔥', color: '#f97316' }, levelRequired: 10, xpReward: 35 },
  { key: 'bd-support', type: 'badge', name: 'Grand Supporter', nameAr: 'الداعم الكبير', description: 'Certified pillar of the community', descriptionAr: 'ركن معتمد في المجتمع', price: 2500, rarity: 'epic', payload: { icon: '🛡️', color: '#22d3ee' }, levelRequired: 15, xpReward: 45 },
  { key: 'bd-serious', type: 'badge', name: 'Solemnity', nameAr: 'الجدية', description: 'Respected, focused, unstoppable', descriptionAr: 'محترم، مركّز، لا يوقفه شيء', price: 3000, rarity: 'legendary', payload: { icon: '⚜️', color: '#a78bfa' }, levelRequired: 20, xpReward: 50 },
  { key: 'bd-talk', type: 'badge', name: 'Conversation Master', nameAr: 'سيد المحادثة', description: 'Thousand-conversation veteran', descriptionAr: 'محارب في ألف محادثة', price: 3500, rarity: 'legendary', payload: { icon: '💬', color: '#ec4899' }, levelRequired: 25, xpReward: 55 },
  { key: 'bd-impact', type: 'badge', name: 'Impact', nameAr: 'الأثر', description: 'Left a mark on everyone they met', descriptionAr: 'ترك أثراً في كل من قابله', price: 4000, rarity: 'legendary', payload: { icon: '✨', color: '#fde047' }, levelRequired: 30, xpReward: 60 },
  { key: 'bd-owner', type: 'badge', name: 'Realm Owner', nameAr: 'مالك المملكة', description: 'Rules their own Meev realm', descriptionAr: 'يحكم مملكته في ميف', price: 5000, rarity: 'legendary', payload: { icon: '👑', color: '#f59e0b' }, levelRequired: 40, xpReward: 75 },

  // ---- v8: VIP badges for the BIG tiers (level-gated legends) ----
  { key: 'bd-phoenix', type: 'badge', name: 'Phoenix Soul', nameAr: 'روح العنقاء', description: 'Reborn from every chat — level 50 VIP', descriptionAr: 'تنبعث من كل محادثة — فئة كبار فل ٥٠', price: 6000, rarity: 'legendary', payload: { icon: '🔥', color: '#fb923c' }, levelRequired: 50, xpReward: 90 },
  { key: 'bd-titan', type: 'badge', name: 'Titan', nameAr: 'العملاق', description: 'Unshakeable presence — level 75 VIP', descriptionAr: 'حضور لا يهتز — فئة كبار فل ٧٥', price: 8000, rarity: 'legendary', payload: { icon: '🗿', color: '#a3e635' }, levelRequired: 75, xpReward: 110 },
  { key: 'bd-cosmos', type: 'badge', name: 'Cosmos Lord', nameAr: 'سيد الكون', description: 'A whole universe in one profile — level 100 VIP', descriptionAr: 'كون كامل في ملف واحد — فئة كبار فل ١٠٠', price: 12000, rarity: 'legendary', payload: { icon: '🌌', color: '#818cf8' }, levelRequired: 100, xpReward: 140 },
  { key: 'bd-meevgod', type: 'badge', name: 'Meev God', nameAr: 'إله ميف', description: 'The absolute apex of Meev — level 150 VIP', descriptionAr: 'قمة ميف المطلقة — فئة كبار فل ١٥٠', price: 20000, rarity: 'legendary', payload: { icon: '😻', color: '#fde047' }, levelRequired: 150, xpReward: 200 },
]

export function shopItem(key: string): ShopItemDef | undefined {
  return SHOP_ITEMS.find((i) => i.key === key)
}

// --------------- Weekly spin wheel prizes (v16: coins ONLY — weekly, capped) ---------------
// XP never comes from the wheel (levels are time-based only); the spin stays
// a small weekly coin surprise, capped at 5 Gold Meev per week.
export const SPIN_PRIZES: { coins: number; label: string; labelAr: string; weight: number }[] = [
  { coins: 0, label: 'Better luck next week!', labelAr: 'حظ أوفر الأسبوع الجاي!', weight: 30 },
  { coins: 1, label: '1 Gold Meev', labelAr: 'ذهبة واحدة', weight: 28 },
  { coins: 2, label: '2 Gold Meev', labelAr: 'ذهبتان', weight: 20 },
  { coins: 3, label: '3 Gold Meev', labelAr: '٣ ذهبات', weight: 12 },
  { coins: 4, label: '4 Gold Meev', labelAr: '٤ ذهبات', weight: 7 },
  { coins: 5, label: 'TOP PRIZE 5!', labelAr: 'الجائزة الكبرى ٥!', weight: 3 },
]

// --------------- DM streak flames (v3 — TikTok-style, but developed) ---------------
/** Every 3 consecutive days of chatting unlocks the next chat theme + flame tier. */
export const STREAK_THEME_STEP = 3
export const STREAK_TIERS: { days: number; flameColor: string; label: string; labelAr: string }[] = [
  { days: 0, flameColor: '#64748b', label: 'No streak yet', labelAr: 'لا سلسلة بعد' },
  { days: 1, flameColor: '#f97316', label: 'Spark', labelAr: 'شرارة' },
  { days: 3, flameColor: '#f43f5e', label: 'Flame', labelAr: 'شعلة' },
  { days: 7, flameColor: '#ec4899', label: 'Blaze', labelAr: 'لهيب' },
  { days: 14, flameColor: '#a855f7', label: 'Inferno', labelAr: 'حرائق' },
  { days: 30, flameColor: '#f59e0b', label: 'Eternal Fire', labelAr: 'نار أبدية' },
  { days: 100, flameColor: '#fde047', label: 'LEGENDARY', labelAr: 'أسطورية' },
]

export function streakTier(streakDays: number) {
  let tier = STREAK_TIERS[0]
  for (const t of STREAK_TIERS) if (streakDays >= t.days) tier = t
  return tier
}

// --------------- Chat themes (v3 — unlocked by DM streak milestones) ---------------
export type ChatThemeDef = {
  key: string
  name: string
  nameAr: string
  requiredStreak: number
  /** chat area background (css value) */
  bg: string
  /** bubble accent gradient for BOTH users */
  accent: string
  /** extra sticker emojis unlocked with the theme */
  emojis?: string[]
  /** animated flame frame color around avatars in this chat (streak reward) */
  frame?: string
}

export const CHAT_THEMES: ChatThemeDef[] = [
  { key: 'classic', name: 'Classic', nameAr: 'كلاسيكي', requiredStreak: 0, bg: 'radial-gradient(rgba(168,85,247,.03) 1px, transparent 1px)', accent: 'linear-gradient(90deg,#a855f7,#ec4899)' },
  { key: 'cozy', name: 'Cozy Warm', nameAr: 'دفء الأنس', requiredStreak: 3, bg: 'linear-gradient(180deg,rgba(251,191,36,.05),rgba(236,72,153,.05))', accent: 'linear-gradient(90deg,#f59e0b,#f472b6)', emojis: ['🧡', '🕯️', '🫶', '🛋️'] },
  { key: 'sunset', name: 'Sunset', nameAr: 'غروب', requiredStreak: 6, bg: 'linear-gradient(180deg,rgba(244,63,94,.06),rgba(245,158,11,.06))', accent: 'linear-gradient(90deg,#f43f5e,#f97316)', emojis: ['🌅', '🧡', '✨'] },
  { key: 'ocean', name: 'Ocean', nameAr: 'محيط', requiredStreak: 9, bg: 'linear-gradient(180deg,rgba(6,182,212,.06),rgba(59,130,246,.05))', accent: 'linear-gradient(90deg,#06b6d4,#3b82f6)', emojis: ['🌊', '🐬', '🫧', '🐚'] },
  { key: 'sakura', name: 'Sakura', nameAr: 'ساكورا', requiredStreak: 12, bg: 'linear-gradient(180deg,rgba(244,114,182,.07),rgba(251,207,232,.05))', accent: 'linear-gradient(90deg,#f472b6,#fbcfe8)', emojis: ['🌸', '🍃', '🌺', '💮'], frame: '#f472b6' },
  { key: 'neon', name: 'Neon City', nameAr: 'مدينة النيون', requiredStreak: 18, bg: 'linear-gradient(180deg,rgba(168,85,247,.08),rgba(6,182,212,.06))', accent: 'linear-gradient(90deg,#a855f7,#22d3ee)', emojis: ['🌃', '🎛️', '💡', '🔊'], frame: '#22d3ee' },
  { key: 'galaxy', name: 'Galaxy', nameAr: 'مجرة', requiredStreak: 24, bg: 'linear-gradient(180deg,rgba(76,29,149,.12),rgba(168,85,247,.07))', accent: 'linear-gradient(90deg,#7c3aed,#a855f7,#ec4899)', emojis: ['🌌', '🪐', '⭐', '🚀'], frame: '#a855f7' },
  { key: 'rainbow', name: 'RAINBOW', nameAr: 'قوس قزح', requiredStreak: 30, bg: 'linear-gradient(180deg,rgba(236,72,153,.06),rgba(245,158,11,.06),rgba(34,197,94,.06),rgba(59,130,246,.06))', accent: 'linear-gradient(90deg,#f43f5e,#f97316,#eab308,#22c55e,#06b6d4,#a855f7)', emojis: ['🌈', '💖', '⚡', '🎉'], frame: '#eab308' },
]

export function chatTheme(key: string): ChatThemeDef | undefined {
  return CHAT_THEMES.find((t) => t.key === key)
}

/** Themes unlocked for a conversation given its current streak. */
export function unlockedThemes(streakDays: number): ChatThemeDef[] {
  return CHAT_THEMES.filter((t) => t.requiredStreak <= streakDays)
}

// --------------- Support ticket categories ---------------
export const SUPPORT_CATEGORIES: { key: string; label: string; labelAr: string; emoji: string }[] = [
  { key: 'account', label: 'Account & Login', labelAr: 'الحساب والدخول', emoji: '🔐' },
  { key: 'gifts_coins', label: 'Gifts & Gold', labelAr: 'الهدايا والذهب', emoji: '🪙' },
  { key: 'harassment', label: 'Harassment / Report', labelAr: 'إساءة أو بلاغ', emoji: '🚨' },
  { key: 'bug', label: 'Something broke', labelAr: 'خلل في الموقع', emoji: '🐛' },
  { key: 'other', label: 'Something else', labelAr: 'شيء آخر', emoji: '💬' },
]

// --------------- RPS duel (chat mini-game) ---------------
export const RPS_MOVES = ['rock', 'paper', 'scissors'] as const
export type RpsMove = (typeof RPS_MOVES)[number]
