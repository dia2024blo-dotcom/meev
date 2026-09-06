// ============================================================
// MEEV — Database seed (run: `bun prisma/seed.ts`)
// Wipes & re-seeds the demo dataset (use `--keep` to skip wiping).
// Demo accounts password: 'Meev1234!' (login hint: mochi / Meev1234!)
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { newId } from '../src/lib/meev/ids'
import { hashPassword } from '../src/lib/meev/auth'
import { BADGES, GIFTS, SHOP_ITEMS, type ShopItemDef } from '../src/lib/meev/constants'

const db = new PrismaClient()

// deterministic RNG so re-seeds are stable-ish
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20270420)
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000)

// ------------------------- wipe -------------------------

async function wipe() {
  // FK-safe order: children first
  await db.reaction.deleteMany()
  await db.message.deleteMany()
  await db.miniGame.deleteMany()
  await db.storyView.deleteMany()
  await db.story.deleteMany()
  await db.comment.deleteMany()
  await db.like.deleteMany()
  await db.post.deleteMany()
  await db.notification.deleteMany()
  await db.gift.deleteMany()
  await db.userBadge.deleteMany()
  await db.pointsLog.deleteMany()
  await db.emailToken.deleteMany()
  await db.refreshToken.deleteMany()
  await db.session.deleteMany()
  await db.auditLog.deleteMany()
  await db.friendRequest.deleteMany()
  await db.follow.deleteMany()
  await db.block.deleteMany()
  await db.report.deleteMany()
  await db.channel.deleteMany()
  await db.serverMember.deleteMany()
  await db.server.deleteMany()
  await db.dMConversation.deleteMany()
  await db.giftCatalog.deleteMany()
  await db.badgeCatalog.deleteMany()
  await db.userItem.deleteMany()
  await db.shopCatalog.deleteMany()
  await db.coinLog.deleteMany()
  await db.supportTicket.deleteMany()
  await db.user.deleteMany()
}

// ------------------------- data -------------------------

type DemoUser = {
  username: string
  displayName: string
  xp: number
  coins: number
  city: string | null
  presence: string
  seed: string
  interests: string[]
  bio: string
  nameColor: string
  createdDaysAgo: number
  lastActiveHoursAgo: number
}

const BOT_USERNAME = 'meevbot'

const DEMO_USERS: DemoUser[] = [
  { username: 'mochi', displayName: 'Mochi', xp: 1632, coins: 2000, city: 'Riyadh', presence: 'online', seed: 'mochi|sunset|2', interests: ['anime', 'gaming', 'music', 'memes', 'pets'], bio: 'Soft cat in a loud world 🐾 lattes over everything', nameColor: '#f43f5e', createdDaysAgo: 88, lastActiveHoursAgo: 0.2 },
  { username: 'luna', displayName: 'Luna ✨', xp: 2880, coins: 540, city: 'Tokyo', presence: 'online', seed: 'lavender|violet|0', interests: ['anime', 'art', 'books', 'photography'], bio: 'Night sky enthusiast. Moon photographer 🌙', nameColor: '#a855f7', createdDaysAgo: 82, lastActiveHoursAgo: 1 },
  { username: 'pixel', displayName: 'Pixel', xp: 23976, coins: 800, city: 'Dubai', presence: 'busy', seed: 'shadow|neon|1', interests: ['programming', 'gaming', 'crypto', 'science'], bio: 'lvl 999 — I ship code and cats 🚀', nameColor: '#06b6d4', createdDaysAgo: 90, lastActiveHoursAgo: 0.5 },
  { username: 'whiskers', displayName: 'Whiskers', xp: 120, coins: 320, city: 'Cairo', presence: 'online', seed: 'cloud|teal|3', interests: ['pets', 'cooking', 'memes'], bio: 'Just here for the snacks 🍗', nameColor: '', createdDaysAgo: 21, lastActiveHoursAgo: 2 },
  { username: 'nala', displayName: 'Nala', xp: 816, coins: 410, city: 'Jeddah', presence: 'offline', seed: 'cherry|rose|1', interests: ['music', 'fashion', 'travel', 'photography'], bio: 'Sunsets & playlists 🌇', nameColor: '#ec4899', createdDaysAgo: 64, lastActiveHoursAgo: 9 },
  { username: 'simba', displayName: 'Simba', xp: 288, coins: 350, city: 'Doha', presence: 'online', seed: 'honey|gold|0', interests: ['sports', 'fitness', 'gaming'], bio: 'Gym → pitch → ranked lobby 🦁', nameColor: '', createdDaysAgo: 45, lastActiveHoursAgo: 3 },
  { username: 'mika', displayName: 'Mika', xp: 1320, coins: 700, city: 'Istanbul', presence: 'dnd', seed: 'mint|ocean|2', interests: ['music', 'art', 'anime', 'movies'], bio: 'Painting soundwaves 🎨', nameColor: '#14b8a6', createdDaysAgo: 71, lastActiveHoursAgo: 1.5 },
  { username: 'oreo', displayName: 'Oreo', xp: 72, coins: 300, city: 'Casablanca', presence: 'offline', seed: 'midnight|slate|1', interests: ['memes', 'pets'], bio: '2 cookies away from greatness', nameColor: '', createdDaysAgo: 14, lastActiveHoursAgo: 26 },
  { username: 'pepper', displayName: 'Pepper', xp: 216, coins: 380, city: 'Riyadh', presence: 'online', seed: 'mint|forest|0', interests: ['cooking', 'fitness', 'science'], bio: 'Spicy food scientist 🌶️', nameColor: '', createdDaysAgo: 38, lastActiveHoursAgo: 0.8 },
  { username: 'shadow', displayName: 'Shadow', xp: 1848, coins: 760, city: 'Dubai', presence: 'online', seed: 'shadow|violet|3', interests: ['gaming', 'programming', 'science', 'memes'], bio: 'Night owl dev — PRs welcome', nameColor: '#a855f7', createdDaysAgo: 77, lastActiveHoursAgo: 0.4 },
  { username: 'marmalade', displayName: 'Marmalade', xp: 504, coins: 430, city: 'Jeddah', presence: 'online', seed: 'honey|sunset|1', interests: ['cooking', 'books', 'pets', 'travel'], bio: 'Reading recipes like novels 📚', nameColor: '#f59e0b', createdDaysAgo: 52, lastActiveHoursAgo: 5 },
  { username: 'tofu', displayName: 'Tofu', xp: 48, coins: 300, city: 'Cairo', presence: 'online', seed: 'cloud|ocean|0', interests: ['anime', 'memes', 'music'], bio: 'soft block of chaos', nameColor: '', createdDaysAgo: 9, lastActiveHoursAgo: 0.6 },
  { username: 'muezza', displayName: 'Muezza', xp: 1056, coins: 520, city: 'Istanbul', presence: 'busy', seed: 'mochi|rose|2', interests: ['books', 'science', 'art', 'pets'], bio: 'Curious cat, infinite questions ❓', nameColor: '#22c55e', createdDaysAgo: 69, lastActiveHoursAgo: 2.5 },
  { username: 'pixel2', displayName: 'Pixel 2.0', xp: 360, coins: 480, city: 'Dubai', presence: 'online', seed: 'cherry|neon|1', interests: ['programming', 'memes', 'gaming'], bio: 'the sequel nobody asked for 😹', nameColor: '', createdDaysAgo: 30, lastActiveHoursAgo: 4 },
]

const FOLLOWS: [string, string][] = [
  ['mochi', 'luna'], ['mochi', 'pixel'], ['mochi', 'mika'], ['mochi', 'muezza'], ['mochi', BOT_USERNAME], ['mochi', 'tofu'], ['mochi', 'nala'],
  ['luna', 'mochi'], ['luna', 'mika'], ['luna', 'muezza'], ['luna', 'pixel'], ['luna', 'marmalade'], ['luna', BOT_USERNAME],
  ['pixel', 'shadow'], ['pixel', 'pixel2'], ['pixel', 'mochi'], ['pixel', BOT_USERNAME], ['pixel', 'mika'],
  ['whiskers', 'mochi'], ['whiskers', 'oreo'], ['whiskers', 'pepper'], ['whiskers', 'tofu'], ['whiskers', BOT_USERNAME],
  ['nala', 'luna'], ['nala', 'mika'], ['nala', 'marmalade'], ['nala', 'mochi'], ['nala', BOT_USERNAME],
  ['simba', 'pepper'], ['simba', 'shadow'], ['simba', 'pixel'], ['simba', 'mochi'], ['simba', BOT_USERNAME],
  ['mika', 'luna'], ['mika', 'mochi'], ['mika', 'nala'], ['mika', 'muezza'], ['mika', BOT_USERNAME], ['mika', 'tofu'],
  ['oreo', 'tofu'], ['oreo', 'whiskers'], ['oreo', 'mochi'], ['oreo', BOT_USERNAME],
  ['pepper', 'simba'], ['pepper', 'marmalade'], ['pepper', 'mochi'], ['pepper', BOT_USERNAME], ['pepper', 'nala'],
  ['shadow', 'pixel'], ['shadow', 'pixel2'], ['shadow', 'mochi'], ['shadow', 'mika'], ['shadow', BOT_USERNAME], ['shadow', 'simba'],
  ['marmalade', 'nala'], ['marmalade', 'pepper'], ['marmalade', 'muezza'], ['marmalade', 'mochi'], ['marmalade', BOT_USERNAME],
  ['tofu', 'oreo'], ['tofu', 'mochi'], ['tofu', 'mika'], ['tofu', BOT_USERNAME],
  ['muezza', 'luna'], ['muezza', 'mika'], ['muezza', 'marmalade'], ['muezza', 'mochi'], ['muezza', BOT_USERNAME],
  ['pixel2', 'pixel'], ['pixel2', 'shadow'], ['pixel2', 'mochi'], ['pixel2', BOT_USERNAME],
  [BOT_USERNAME, 'mochi'],
]

const FRIEND_PAIRS: [string, string][] = [
  ['mochi', 'luna'], ['mochi', 'mika'], ['mochi', 'muezza'], ['mochi', 'pixel'],
  ['luna', 'mika'], ['luna', 'muezza'], ['luna', 'nala'],
  ['pixel', 'shadow'], ['pixel', 'pixel2'],
  ['mika', 'nala'], ['mika', 'muezza'], ['mika', 'tofu'],
  ['shadow', 'simba'], ['shadow', 'pixel2'],
  ['marmalade', 'nala'], ['marmalade', 'pepper'],
  ['pepper', 'simba'], ['tofu', 'oreo'], ['muezza', 'marmalade'], ['whiskers', 'oreo'],
]

const PENDING_REQUESTS: [string, string][] = [
  ['pepper', 'mochi'],
  ['tofu', 'luna'],
  ['simba', 'nala'],
]

const SOCIAL_BUTTERFLY = new Set(['mochi', 'luna', 'mika', 'shadow', 'pixel'])

// media files that ACTUALLY exist
const MEDIA_DIR = path.join(process.cwd(), 'public', 'meev-media')
const availableMedia = new Set(
  fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : []
)
function media(name: string): string | null {
  return availableMedia.has(name) ? `/meev-media/${name}` : null
}

type PostSpec = { author: string; content: string; image?: string; hoursAgo: number }

const POSTS: PostSpec[] = [
  { author: 'mochi', content: 'new keyboard who dis ⌨️✨ rate my setup (be nice)', image: 'gaming.png', hoursAgo: 26 },
  { author: 'pixel', content: 'shipped the biggest refactor of my life. tests green. coffee cold. life good 🚀', image: 'dev-setup.png', hoursAgo: 8 },
  { author: 'luna', content: 'tokyo at golden hour hits different 🌇', image: 'anime-city.png', hoursAgo: 20 },
  { author: 'mochi', content: 'me: i\u2019ll sleep early tonight\nalso me at 3am: 😼', hoursAgo: 30 },
  { author: 'shadow', content: 'who else codes better at 2am than 2pm? asking for a friend (it\u2019s me)', hoursAgo: 12 },
  { author: 'mika', content: 'painted my cat again. she was NOT cooperative 🎨', hoursAgo: 18 },
  { author: 'nala', content: 'weekend haul 🛍️ my wallet is crying but my closet is thriving', hoursAgo: 45 },
  { author: 'simba', content: '5km before sunrise. the cat only watched 🏃‍♂️', hoursAgo: 33 },
  { author: 'pepper', content: 'tried a 5-chili curry. i have seen the void. 🌶️👁️', hoursAgo: 15 },
  { author: 'tofu', content: 'just beat the final boss. my thumbs hurt. worth it.', hoursAgo: 6 },
  { author: 'muezza', content: 'book #23 this year: cats behave like liquid. proof on page 42 📚', hoursAgo: 28 },
  { author: 'marmalade', content: 'baked cinnamon rolls at 1am. the kitchen survived (barely) 🍥', hoursAgo: 22 },
  { author: 'pixel', content: 'when the CSS finally centers itself: 🧘', hoursAgo: 100 },
  { author: 'mochi', content: 'cat café duty calls ☕🐱', image: 'cat-cafe.png', hoursAgo: 70 },
  { author: 'luna', content: 'album of the month: synths and sadness 🎧', image: 'synthwave.png', hoursAgo: 90 },
  { author: 'whiskers', content: 'learned to make fresh fish today. the cat approves. (it\u2019s me. i\u2019m the cat.)', hoursAgo: 50 },
  { author: 'pixel2', content: 'my repo has 0 comments and 100 secrets. as intended 😹', hoursAgo: 10 },
  { author: 'shadow', content: 'this meeting could have been a /poll. that\u2019s it. that\u2019s the post.', hoursAgo: 4 },
  { author: 'mika', content: 'drew the whole Meev squad as cats. which one are you? 🐈', image: 'cat-squad.png', hoursAgo: 3 },
  { author: BOT_USERNAME, content: 'welcome to the feed, traveler 🐾 be kind, stay curious, and pet a cat today.', hoursAgo: 2 },
]

const COMMENTS: { postIdx: number; author: string; content: string; minutesAfterPost: number }[] = [
  { postIdx: 0, author: 'luna', content: 'the pastel keycaps!! where 👀', minutesAfterPost: 40 },
  { postIdx: 0, author: 'shadow', content: 'cable management 10/10 no notes', minutesAfterPost: 95 },
  { postIdx: 0, author: 'pixel', content: 'RGB budget exceeding GPU budget, classic', minutesAfterPost: 180 },
  { postIdx: 1, author: 'pixel2', content: 'meanwhile my code has 47 todos', minutesAfterPost: 30 },
  { postIdx: 1, author: 'shadow', content: 'tests green = best feeling in the world', minutesAfterPost: 62 },
  { postIdx: 1, author: 'muezza', content: 'congrats!! coffee refill incoming ☕', minutesAfterPost: 150 },
  { postIdx: 2, author: 'mika', content: 'the lighting tho 🤌', minutesAfterPost: 55 },
  { postIdx: 2, author: 'mochi', content: 'adding to my travel list immediately', minutesAfterPost: 120 },
  { postIdx: 3, author: 'tofu', content: 'relatable content only 😹', minutesAfterPost: 22 },
  { postIdx: 4, author: 'pixel', content: '2am gang rises 🌙', minutesAfterPost: 35 },
  { postIdx: 5, author: 'luna', content: 'she sounds exactly like my model 😂', minutesAfterPost: 70 },
  { postIdx: 5, author: 'muezza', content: 'gallery when?', minutesAfterPost: 130 },
  { postIdx: 6, author: 'pepper', content: 'closet thriving > wallet crying. facts.', minutesAfterPost: 44 },
  { postIdx: 7, author: 'pepper', content: 'beast mode 🦁💪', minutesAfterPost: 50 },
  { postIdx: 8, author: 'marmalade', content: 'the void says hi back 👋', minutesAfterPost: 66 },
  { postIdx: 9, author: 'oreo', content: 'W boson energy ⚛️', minutesAfterPost: 25 },
  { postIdx: 10, author: 'marmalade', content: 'page 42 never lies 📖', minutesAfterPost: 80 },
  { postIdx: 11, author: 'mochi', content: 'drop the recipe or we riot', minutesAfterPost: 41 },
  { postIdx: 13, author: 'nala', content: 'save me a seat by the window ☕', minutesAfterPost: 90 },
  { postIdx: 14, author: 'mika', content: 'synthwave forever 🎹🌊', minutesAfterPost: 140 },
  { postIdx: 17, author: 'pixel', content: 'filed under: things I say daily', minutesAfterPost: 20 },
  { postIdx: 18, author: 'tofu', content: 'i\u2019m the sleepy one obviously 😴', minutesAfterPost: 30 },
]

const STORIES: { author: string; kind: 'text' | 'image'; content: string; gradient: string; image?: string; hoursAgo: number }[] = [
  { author: 'luna', kind: 'text', content: 'moon rising over the city tonight 🌕', gradient: 'midnight', hoursAgo: 2 },
  { author: 'mochi', kind: 'text', content: 'latte art attempt #47 (it\u2019s a blob)', gradient: 'candy', hoursAgo: 3 },
  { author: 'mika', kind: 'image', content: 'gallery opening tonight 🎨', gradient: 'sunset', image: 'cat-portrait.png', hoursAgo: 1 },
  { author: 'pixel', kind: 'text', content: '99.99% uptime, 0% sleep', gradient: 'neon', hoursAgo: 4 },
  { author: 'marmalade', kind: 'image', content: 'squad goals 🐈', gradient: 'lava', image: 'cat-squad.png', hoursAgo: 5 },
  { author: 'tofu', kind: 'text', content: 'manifesting main character energy ✨', gradient: 'sunset', hoursAgo: 6 },
]

type ServerSpec = {
  key: string
  name: string
  description: string
  iconEmoji: string
  accentColor: string
  isOfficial: boolean
  owner: string
  members: { username: string; role: string }[]
  channels: { name: string; topic: string }[]
}

const SERVERS: ServerSpec[] = [
  {
    key: 'cafe',
    name: 'Meev Café ☕',
    description: 'The coziest corner of the internet. Coffee, cats, and chill conversation.',
    iconEmoji: '☕',
    accentColor: '#f59e0b',
    isOfficial: true,
    owner: BOT_USERNAME,
    members: [
      { username: BOT_USERNAME, role: 'owner' },
      ...['mochi', 'luna', 'pixel', 'whiskers', 'nala', 'simba', 'mika', 'oreo', 'pepper', 'shadow', 'marmalade', 'tofu', 'muezza', 'pixel2'].map((username) => ({ username, role: 'member' })),
    ],
    channels: [
      { name: 'general', topic: 'anything and everything (respectfully)' },
      { name: 'introductions', topic: 'say hi, tell us your favorite snack' },
      { name: 'random', topic: 'chaos mode — carefully curated' },
      { name: 'cat-pics', topic: 'mandatory daily cat content' },
    ],
  },
  {
    key: 'gaming',
    name: 'Gaming Den 🎮',
    description: 'Ranked or casual, keyboard or controller — all cats welcome.',
    iconEmoji: '🎮',
    accentColor: '#a855f7',
    isOfficial: false,
    owner: 'mochi',
    members: [
      { username: 'mochi', role: 'owner' },
      { username: 'pixel', role: 'mod' },
      { username: 'simba', role: 'member' },
      { username: 'shadow', role: 'admin' },
      { username: 'pixel2', role: 'member' },
      { username: 'whiskers', role: 'member' },
      { username: 'oreo', role: 'member' },
      { username: 'pepper', role: 'member' },
    ],
    channels: [
      { name: 'general', topic: 'GGs and patch notes' },
      { name: 'lfg', topic: 'looking for group — drop your rank' },
      { name: 'clips', topic: 'your best (and worst) plays' },
    ],
  },
  {
    key: 'anime',
    name: 'Anime Alley 🌸',
    description: 'Seasonal watch parties, manga stacks, and healthy waifu debates.',
    iconEmoji: '🌸',
    accentColor: '#ec4899',
    isOfficial: false,
    owner: 'luna',
    members: [
      { username: 'luna', role: 'owner' },
      { username: 'mika', role: 'mod' },
      { username: 'tofu', role: 'member' },
      { username: 'marmalade', role: 'member' },
      { username: 'nala', role: 'member' },
      { username: 'mochi', role: 'member' },
      { username: 'oreo', role: 'member' },
    ],
    channels: [
      { name: 'general', topic: 'what are we watching this season?' },
      { name: 'manga-discussion', topic: 'spoiler tags or banishment' },
      { name: 'waifu-wars', topic: 'pick your fighter, no takebacks' },
    ],
  },
  {
    key: 'dev',
    name: 'Dev Lounge 💻',
    description: 'Rubber ducks, PR reviews, and 2am deploys. TypeScript preferred, tolerated otherwise.',
    iconEmoji: '💻',
    accentColor: '#06b6d4',
    isOfficial: false,
    owner: 'pixel',
    members: [
      { username: 'pixel', role: 'owner' },
      { username: 'pixel2', role: 'mod' },
      { username: 'shadow', role: 'admin' },
      { username: 'muezza', role: 'member' },
      { username: 'mika', role: 'member' },
      { username: 'mochi', role: 'member' },
    ],
    channels: [
      { name: 'general', topic: 'standup but cozy' },
      { name: 'help-showcase', topic: 'stuck? show us the stack trace' },
      { name: 'code-review', topic: 'kind, constructive, brutal only to bugs' },
    ],
  },
]

const SERVER_MESSAGES: { server: string; channel: string; author: string; content: string; minutesAgo: number; reactions?: { emoji: string; by: string[] }[] }[] = [
  { server: 'cafe', channel: 'general', author: 'mochi', content: 'morning everyone ☕ who\u2019s up?', minutesAgo: 540, reactions: [{ emoji: '☕', by: ['luna', 'mika'] }] },
  { server: 'cafe', channel: 'general', author: 'luna', content: 'barely. the moon kept me up 🌙', minutesAgo: 532 },
  { server: 'cafe', channel: 'general', author: 'pepper', content: 'coffee count: 3. it\u2019s 9am. i\u2019m fine.', minutesAgo: 518, reactions: [{ emoji: '😹', by: ['mochi', 'shadow', 'tofu'] }] },
  { server: 'cafe', channel: 'general', author: BOT_USERNAME, content: 'reminder: be kind, pet a cat, drink water 🐾', minutesAgo: 500, reactions: [{ emoji: '🐾', by: ['mochi', 'luna', 'pixel', 'mika'] }] },
  { server: 'cafe', channel: 'general', author: 'muezza', content: 'question of the day: is a hotdog a sandwich? defend your answer', minutesAgo: 240, reactions: [{ emoji: '🤔', by: ['marmalade', 'simba'] }] },
  { server: 'cafe', channel: 'general', author: 'simba', content: 'it\u2019s a taco. i will not elaborate.', minutesAgo: 232, reactions: [{ emoji: '💀', by: ['muezza', 'pepper', 'whiskers'] }] },
  { server: 'cafe', channel: 'introductions', author: 'whiskers', content: 'hi! whiskers. i like snacks, naps, and more snacks 🍗', minutesAgo: 4000 },
  { server: 'cafe', channel: 'introductions', author: 'tofu', content: 'tofu here. soft but resilient.', minutesAgo: 3600, reactions: [{ emoji: '🤍', by: ['mika'] }] },
  { server: 'cafe', channel: 'random', author: 'oreo', content: 'just found out cats can\u2019t taste sweet. my whole life is a lie', minutesAgo: 1500, reactions: [{ emoji: '😹', by: ['whiskers', 'mochi'] }] },
  { server: 'cafe', channel: 'cat-pics', author: 'mochi', content: 'found her asleep in the cereal box again 🥲', minutesAgo: 300, reactions: [{ emoji: '❤️', by: ['luna', 'nala', 'mika', 'marmalade'] }] },
  { server: 'cafe', channel: 'cat-pics', author: 'mika', content: 'art subject of the day: extremely unimpressed', minutesAgo: 290 },
  { server: 'cafe', channel: 'cat-pics', author: 'marmalade', content: 'the loaf formation has been achieved 🍞', minutesAgo: 120, reactions: [{ emoji: '🍞', by: ['mochi', 'muezza'] }] },
  { server: 'gaming', channel: 'general', author: 'mochi', content: 'ranked tonight? need 2 more 🎮', minutesAgo: 420 },
  { server: 'gaming', channel: 'general', author: 'shadow', content: 'in. bring your A game, my ping is 12ms 😎', minutesAgo: 415, reactions: [{ emoji: '🔥', by: ['mochi', 'pixel2'] }] },
  { server: 'gaming', channel: 'general', author: 'pixel', content: 'i\u2019ll spectate and backseat aggressively', minutesAgo: 410, reactions: [{ emoji: '😂', by: ['simba'] }] },
  { server: 'gaming', channel: 'general', author: 'simba', content: 'GGs everyone. that last round was criminal 😤', minutesAgo: 55, reactions: [{ emoji: '🏆', by: ['mochi', 'shadow'] }] },
  { server: 'gaming', channel: 'lfg', author: 'whiskers', content: 'support main looking for duo. i heal, i steal snacks.', minutesAgo: 700, reactions: [{ emoji: '🙏', by: ['oreo'] }] },
  { server: 'gaming', channel: 'lfg', author: 'pepper', content: 'need 1 more for the raid, 3 chill cats and me 🌶️', minutesAgo: 180 },
  { server: 'gaming', channel: 'clips', author: 'pixel2', content: 'clutched 1v4 with 3 hp. no i will not calm down.', minutesAgo: 600, reactions: [{ emoji: '🐐', by: ['pixel', 'shadow', 'mochi', 'simba'] }] },
  { server: 'gaming', channel: 'clips', author: 'oreo', content: 'my best clip is me walking off a cliff. peak content.', minutesAgo: 500, reactions: [{ emoji: '💀', by: ['whiskers', 'pepper'] }] },
  { server: 'anime', channel: 'general', author: 'luna', content: 'episode 7 tonight. bring tissues 🌸', minutesAgo: 380, reactions: [{ emoji: '😭', by: ['mika', 'tofu'] }] },
  { server: 'anime', channel: 'general', author: 'mika', content: 'i already know which scene. i\u2019m ready. (i\u2019m not ready)', minutesAgo: 375 },
  { server: 'anime', channel: 'general', author: 'tofu', content: 'rewatching the whole season just to suffer properly', minutesAgo: 90, reactions: [{ emoji: '🌸', by: ['luna'] }] },
  { server: 'anime', channel: 'manga-discussion', author: 'marmalade', content: 'chapter 204 spoiler: ||the cat was the villain all along||', minutesAgo: 800, reactions: [{ emoji: '😱', by: ['nala', 'oreo'] }] },
  { server: 'anime', channel: 'waifu-wars', author: 'nala', content: 'team bookworm supremacy, i said what i said 📚', minutesAgo: 1200, reactions: [{ emoji: '📚', by: ['muezza'] }] },
  { server: 'dev', channel: 'general', author: 'pixel', content: 'deploying friday. yes i\u2019m brave. no i don\u2019t fear the reaper.', minutesAgo: 300, reactions: [{ emoji: '💀', by: ['shadow', 'pixel2', 'muezza'] }] },
  { server: 'dev', channel: 'general', author: 'shadow', content: 'rollbacks exist for a reason, legend', minutesAgo: 295 },
  { server: 'dev', channel: 'general', author: 'muezza', content: 'hot take: tabs, spaces, whichever — name your variables well', minutesAgo: 130, reactions: [{ emoji: '👑', by: ['pixel', 'shadow'] }] },
  { server: 'dev', channel: 'help-showcase', author: 'pixel2', content: 'why is my useEffect running twice 😭 react 19 btw', minutesAgo: 200 },
  { server: 'dev', channel: 'help-showcase', author: 'shadow', content: 'strict mode double-invokes effects in dev — it\u2019s a feature™️', minutesAgo: 195, reactions: [{ emoji: '🤯', by: ['pixel2'] }] },
  { server: 'dev', channel: 'code-review', author: 'pixel', content: 'reviewed the whole PR. 47 comments. all of them say \u201cnice\u201d.', minutesAgo: 60, reactions: [{ emoji: '😂', by: ['mika', 'mochi'] }] },
]

const DM_SEEDS: { a: string; b: string; messages: { author: string; content: string; minutesAgo: number }[] }[] = [
  {
    a: 'mochi', b: 'luna',
    messages: [
      { author: 'mochi', content: 'did you see the moon last night?? huge 🌕', minutesAgo: 400 },
      { author: 'luna', content: 'i took 200 photos of it. 199 are blurry 😅', minutesAgo: 392 },
      { author: 'mochi', content: 'the one good one better be framed', minutesAgo: 385 },
      { author: 'luna', content: 'it\u2019s already my story 😌', minutesAgo: 380 },
      { author: 'mochi', content: 'cat café this weekend? ☕', minutesAgo: 30 },
      { author: 'luna', content: 'YES. window seat. it\u2019s tradition.', minutesAgo: 24 },
    ],
  },
  {
    a: 'pixel', b: 'shadow',
    messages: [
      { author: 'shadow', content: 'review the PR when you get a sec 🙏', minutesAgo: 220 },
      { author: 'pixel', content: 'already did. 47 comments, all say \u201cnice\u201d 😹', minutesAgo: 212 },
      { author: 'shadow', content: 'you\u2019re the reason code review exists', minutesAgo: 208 },
      { author: 'pixel', content: 'deploying friday. pray for me', minutesAgo: 45 },
      { author: 'shadow', content: 'rollbacks exist. go be a legend 🫡', minutesAgo: 40 },
    ],
  },
  {
    a: 'mika', b: 'tofu',
    messages: [
      { author: 'tofu', content: 'your painting of the loaf went hard 🍞', minutesAgo: 150 },
      { author: 'mika', content: 'she posed for exactly 4 seconds. artist\u2019s muse behavior', minutesAgo: 143 },
      { author: 'tofu', content: 'draw me next 🥺', minutesAgo: 140 },
      { author: 'mika', content: 'only if you sit still for more than 3 seconds 😹', minutesAgo: 12 },
    ],
  },
  {
    a: 'pepper', b: 'simba',
    messages: [
      { author: 'pepper', content: 'post-gym meal: 5 chili curry. bad idea. great idea?', minutesAgo: 90 },
      { author: 'simba', content: 'that\u2019s a recovery protocol i cannot endorse 🌶️', minutesAgo: 84 },
      { author: 'pepper', content: 'the gains were spiritual', minutesAgo: 6 },
    ],
  },
]

// ------------------------- v2 shop demo cosmetics -------------------------

/** username -> owned shop items; equipped ones also set the User slot column. */
const DEMO_COSMETICS: { username: string; items: { key: string; equipped: boolean }[] }[] = [
  { username: 'mochi', items: [
    { key: 'ng-sunset', equipped: false },
    { key: 'fr-aura', equipped: false }, // mochi keeps her level-68 aurora name
    { key: 'nc-gold', equipped: true }, // v3: shiny gold name color
    { key: 'pe-hearts', equipped: true }, // v3: heart rain profile effect
    { key: 'cv-aurora', equipped: true }, // v3: animated aurora cover
  ] },
  { username: 'luna', items: [
    { key: 'fr-hearts', equipped: true },
    { key: 'pe-snow', equipped: true }, // v3: snowfall profile effect
    { key: 'cv-nebula', equipped: true }, // v3: nebula cover
  ] },
  { username: 'pixel', items: [
    { key: 'ac-headphones', equipped: true },
    { key: 'aa-legend', equipped: true }, // v3: level-999 ANIMATED AVATAR
    { key: 'cv-legend', equipped: true }, // v3: level-999 LEGEND COVER
    { key: 'nc-rainbow', equipped: true }, // v3: rainbow cycling name
  ] },
  { username: 'shadow', items: [
    { key: 'bd-ghost', equipped: true },
    { key: 'pe-fire', equipped: true }, // v3: fire aura profile effect
  ] },
  { username: 'mika', items: [
    { key: 'pe-aurora', equipped: true }, // v3: aurora waves profile effect
    { key: 'cv-synthwave', equipped: true }, // v3: synthwave cover
  ] },
  { username: BOT_USERNAME, items: [
    { key: 'ng-gold', equipped: true },
    { key: 'ac-crown', equipped: true },
    { key: 'bd-owner', equipped: true }, // v3: realm owner badge
    { key: 'pe-galaxy', equipped: true }, // v3: galaxy orbit effect
    { key: 'cv-rainbow', equipped: true }, // v3: rainbow cover
  ] },
]

const SLOT_COLUMN: Record<string, string> = {
  name_gradient: 'nameGradient',
  name_color: 'nameColor',
  frame: 'frameKey',
  badge: 'badgeShop',
  accessory: 'avatarAcc',
  profile_effect: 'profileEffect',
  cover: 'coverKey',
  animated_avatar: 'avatarAnim', // boolean flag — handled below
}

// ------------------------- seed -------------------------

async function main() {
  const keep = process.argv.includes('--keep')
  if (!keep) {
    console.log('🧹 Wiping database (use --keep to skip)...')
    await wipe()
  } else {
    console.log('🧹 --keep flag: skipping wipe.')
  }

  // ---- catalogs ----
  for (const b of BADGES) {
    await db.badgeCatalog.create({
      data: { key: b.key, name: b.name, description: b.description, icon: b.icon, color: b.color, levelRequired: b.levelRequired },
    })
  }
  for (const g of GIFTS) {
    await db.giftCatalog.create({
      data: { key: g.key, name: g.name, description: g.description, price: g.price, rarity: g.rarity, mood: g.mood, xpReward: g.xpReward },
    })
  }
  // v2 shop catalog — one row per SHOP_ITEMS constant entry
  for (const s of SHOP_ITEMS) {
    await db.shopCatalog.create({
      data: {
        key: s.key,
        type: s.type,
        name: s.name,
        description: s.description,
        price: s.price,
        rarity: s.rarity,
        payload: JSON.stringify(s.payload),
        levelRequired: s.levelRequired,
        xpReward: s.xpReward,
        active: true,
      },
    })
  }
  console.log(`🏷  BadgeCatalog: ${BADGES.length} rows · GiftCatalog: ${GIFTS.length} rows · ShopCatalog: ${SHOP_ITEMS.length} rows`)

  // ---- bot ----
  const botId = BOT_USERNAME
  await db.user.create({
    data: {
      id: botId,
      email: 'bot@meev.local',
      username: BOT_USERNAME,
      displayName: 'Stranger Cat',
      passwordHash: hashPassword(`bot-${newId()}-${Date.now()}!Aa1`),
      avatarSeed: 'honey|gold|1',
      bio: 'Your friendly 1v1 stranger 🐾',
      interests: '[]',
      xp: 1008, // level 42
      coins: 9999,
      presence: 'online',
      nameColor: '#f59e0b',
      isBot: true,
      emailVerifiedAt: daysAgo(90),
      createdAt: daysAgo(90),
      lastActiveAt: new Date(),
    },
  })
  await db.userBadge.create({ data: { id: newId(), userId: botId, badgeKey: 'founder' } })
  console.log(`🤖 MeevBot created (id: ${botId}, level 42)`)

  // ---- demo users ----
  const ids = new Map<string, string>([[BOT_USERNAME, botId]])
  for (const u of DEMO_USERS) {
    const id = newId()
    ids.set(u.username, id)
    await db.user.create({
      data: {
        id,
        email: `${u.username}@meev.app`,
        username: u.username,
        displayName: u.displayName,
        passwordHash: hashPassword('Meev1234!'),
        avatarSeed: u.seed,
        bio: u.bio,
        city: u.city,
        interests: JSON.stringify(u.interests),
        xp: u.xp,
        coins: u.coins,
        presence: u.presence,
        nameColor: u.nameColor,
        emailVerifiedAt: daysAgo(Math.max(1, u.createdDaysAgo - 1)),
        createdAt: daysAgo(u.createdDaysAgo),
        lastActiveAt: hoursAgo(u.lastActiveHoursAgo),
      },
    })
  }
  console.log(`👥 Demo users: ${DEMO_USERS.length} (all password: Meev1234!)`)

  // ---- v2 demo cosmetics (UserItem rows + equipped User slot columns) ----
  let cosmeticCount = 0
  for (const grant of DEMO_COSMETICS) {
    const uid = ids.get(grant.username)
    if (!uid) continue
    const cols: Record<string, string> = {}
    for (const it of grant.items) {
      const def: ShopItemDef | undefined = SHOP_ITEMS.find((s) => s.key === it.key)
      if (!def) continue
      await db.userItem.create({
        data: { id: newId(), userId: uid, itemKey: it.key, equipped: it.equipped },
      })
      cosmeticCount++
      if (it.equipped) {
        if (def.type === 'animated_avatar') {
          await db.user.update({ where: { id: uid }, data: { avatarAnim: true } })
        } else {
          cols[SLOT_COLUMN[def.type]] = it.key
        }
      }
    }
    if (Object.keys(cols).length > 0) {
      await db.user.update({ where: { id: uid }, data: cols })
    }
  }
  console.log(`🛍  Demo cosmetics (v3): ${cosmeticCount} UserItem rows — mochi: gold name + hearts effect + aurora cover · luna: snow + nebula · pixel(999): ANIMATED avatar + LEGEND cover + rainbow name · shadow: fire · mika: aurora + synthwave · bot: owner badge + galaxy + rainbow cover`)

  // ---- v6 OWNER account (othmanxbaroum@gmail.com — full powers) ----
  // The project owner: role=owner, level 999, 999,999 Gold Meev, verified,
  // EVERY shop item owned, legend cosmetics equipped. Password should be
  // changed after first sign-in.
  const OWNER_EMAIL = 'othmanxbaroum@gmail.com'
  const ownerId = newId()
  const ownerEquipped = ['aa-legend', 'cv-legend', 'nc-rainbow', 'pe-galaxy', 'ac-crown', 'bd-owner']
  await db.user.create({
    data: {
      id: ownerId,
      email: OWNER_EMAIL,
      username: 'othman',
      displayName: 'Othman',
      passwordHash: hashPassword('Meev-Owner-2027'),
      avatarSeed: 'honey|gold|0',
      bio: 'صاحب Meev 👑 / Owner of Meev 👑',
      interests: JSON.stringify(['gaming', 'programming', 'anime', 'music']),
      xp: 30000, // level 999 (XP_PER_LEVEL = 24)
      coins: 999999,
      role: 'owner',
      presence: 'online',
      verifiedAt: new Date(),
      emailVerifiedAt: new Date(),
      avatarAnim: true,
      createdAt: daysAgo(120),
      lastActiveAt: new Date(),
    },
  })
  let ownerItems = 0
  const ownerCols: Record<string, string | boolean> = {}
  for (const s of SHOP_ITEMS) {
    const equipped = ownerEquipped.includes(s.key)
    await db.userItem.create({ data: { id: newId(), userId: ownerId, itemKey: s.key, equipped } })
    ownerItems++
    if (equipped) {
      ownerCols[SLOT_COLUMN[s.type]] = s.type === 'animated_avatar' ? true : s.key
    }
  }
  if (Object.keys(ownerCols).length > 0) {
    await db.user.update({ where: { id: ownerId }, data: ownerCols as Record<string, string> })
  }
  console.log(`👑 Owner account seeded (othman / ${OWNER_EMAIL}, password Meev-Owner-2027 — CHANGE IT): level 999 · ${999999} Gold Meev · ${ownerItems}/${SHOP_ITEMS.length} items owned · legend set equipped`)

  // ---- badges ----
  const level = (username: string) => DEMO_USERS.find((u) => u.username === username)!.xp / 24
  for (const u of DEMO_USERS) {
    const uid = ids.get(u.username)!
    await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'founder' } })
    const lvl = Math.floor(level(u.username))
    if (lvl >= 10) await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'lvl-10' } })
    if (lvl >= 50) await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'lvl-50' } })
    if (lvl >= 100) await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'lvl-100' } })
    if (lvl >= 999) await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'lvl-999' } })
    if (SOCIAL_BUTTERFLY.has(u.username)) {
      await db.userBadge.create({ data: { id: newId(), userId: uid, badgeKey: 'social-butterfly' } })
    }
  }

  // ---- follows ----
  for (const [follower, following] of FOLLOWS) {
    const a = ids.get(follower)
    const b = ids.get(following)
    if (!a || !b || a === b) continue
    await db.follow.create({
      data: { id: newId(), followerId: a, followingId: b, createdAt: hoursAgo(randInt(48, 2000)) },
    })
  }
  console.log(`➡️  Follows: ${FOLLOWS.length}`)

  // ---- friend requests ----
  for (const [a, b] of FRIEND_PAIRS) {
    const fromId = ids.get(a)
    const toId = ids.get(b)
    if (!fromId || !toId) continue
    await db.friendRequest.create({
      data: { id: newId(), fromId, toId, status: 'accepted', createdAt: daysAgo(randInt(5, 60)), respondedAt: daysAgo(randInt(1, 4)) },
    })
  }
  for (const [a, b] of PENDING_REQUESTS) {
    const fromId = ids.get(a)
    const toId = ids.get(b)
    if (!fromId || !toId) continue
    await db.friendRequest.create({
      data: { id: newId(), fromId, toId, status: 'pending', createdAt: hoursAgo(randInt(2, 30)) },
    })
  }
  console.log(`🤝 Friend pairs: ${FRIEND_PAIRS.length} accepted · ${PENDING_REQUESTS.length} pending`)

  // ---- posts ----
  const postIds: string[] = []
  const postAuthors: string[] = []
  for (const p of POSTS) {
    const authorId = ids.get(p.author)
    if (!authorId) continue
    const postId = newId()
    postIds.push(postId)
    postAuthors.push(p.author)
    const imageUrl = p.image ? media(p.image) : null
    await db.post.create({
      data: {
        id: postId,
        authorId,
        content: p.content,
        imageUrl,
        kind: imageUrl ? 'image' : 'text',
        createdAt: hoursAgo(p.hoursAgo),
      },
    })
  }

  // likes: 3-40 per post
  const usernames = DEMO_USERS.map((u) => u.username)
  let likeCount = 0
  for (let i = 0; i < postIds.length; i++) {
    const likers = [...usernames, BOT_USERNAME].filter((u) => u !== postAuthors[i])
    const n = randInt(3, Math.min(40, likers.length))
    // shuffle deterministically and take n
    const shuffled = [...likers]
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = randInt(0, j)
      ;[shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
    }
    for (const username of shuffled.slice(0, n)) {
      const uid = ids.get(username)
      if (!uid) continue
      await db.like.create({ data: { id: newId(), postId: postIds[i], userId: uid } })
      likeCount++
    }
  }
  console.log(`📝 Posts: ${postIds.length} (media referenced: ${[...availableMedia].join(', ') || 'NONE — text only'}) · Likes: ${likeCount}`)

  // comments
  for (const c of COMMENTS) {
    if (c.postIdx >= postIds.length) continue
    const authorId = ids.get(c.author)
    if (!authorId) continue
    const post = await db.post.findUnique({ where: { id: postIds[c.postIdx] } })
    if (!post) continue
    await db.comment.create({
      data: {
        id: newId(),
        postId: post.id,
        authorId,
        content: c.content,
        createdAt: new Date(post.createdAt.getTime() + c.minutesAfterPost * 60_000),
      },
    })
  }
  console.log(`💬 Comments: ${COMMENTS.length}`)

  // ---- stories ----
  let storyCount = 0
  for (const s of STORIES) {
    const authorId = ids.get(s.author)
    if (!authorId) continue
    const imageUrl = s.kind === 'image' && s.image ? media(s.image) : null
    await db.story.create({
      data: {
        id: newId(),
        authorId,
        kind: imageUrl ? 'image' : 'text',
        content: s.content,
        gradient: s.gradient,
        imageUrl,
        createdAt: hoursAgo(s.hoursAgo),
        expiresAt: new Date(Date.now() + 20 * 3600_000),
      },
    })
    storyCount++
  }
  console.log(`📸 Stories: ${storyCount} (expire in 20h)`)

  // ---- servers + channels + members + messages ----
  const channelIds = new Map<string, string>() // `${serverKey}/${channelName}` -> id
  for (const s of SERVERS) {
    const serverId = newId()
    await db.server.create({
      data: {
        id: serverId,
        name: s.name,
        description: s.description,
        iconEmoji: s.iconEmoji,
        accentColor: s.accentColor,
        ownerId: ids.get(s.owner)!,
        isOfficial: s.isOfficial,
        createdAt: daysAgo(randInt(10, 80)),
      },
    })
    for (let position = 0; position < s.channels.length; position++) {
      const ch = s.channels[position]
      const channelId = newId()
      channelIds.set(`${s.key}/${ch.name}`, channelId)
      await db.channel.create({
        data: { id: channelId, serverId, name: ch.name, topic: ch.topic, kind: 'text', position },
      })
    }
    for (const m of s.members) {
      const uid = ids.get(m.username)
      if (!uid) continue
      await db.serverMember.create({
        data: { id: newId(), serverId, userId: uid, role: m.role, joinedAt: daysAgo(randInt(1, 60)) },
      })
    }
  }
  console.log(`🏰 Servers: ${SERVERS.length} · Channels: ${SERVERS.reduce((n, s) => n + s.channels.length, 0)}`)

  // server messages + reactions
  let messageCount = 0
  let reactionCount = 0
  for (const m of SERVER_MESSAGES) {
    const channelId = channelIds.get(`${m.server}/${m.channel}`)
    const authorId = ids.get(m.author)
    if (!channelId || !authorId) continue
    const messageId = newId()
    await db.message.create({
      data: {
        id: messageId,
        scope: 'server',
        channelId,
        authorId,
        content: m.content,
        kind: 'text',
        createdAt: new Date(Date.now() - m.minutesAgo * 60_000),
      },
    })
    messageCount++
    for (const r of m.reactions || []) {
      for (const reactor of r.by) {
        const uid = ids.get(reactor)
        if (!uid || uid === authorId) continue
        await db.reaction.create({ data: { id: newId(), messageId, userId: uid, emoji: r.emoji } })
        reactionCount++
      }
    }
  }
  console.log(`✉️  Server messages: ${messageCount} · Reactions: ${reactionCount}`)

  // ---- DM conversations ----
  let dmCount = 0
  for (const dm of DM_SEEDS) {
    const a = ids.get(dm.a)
    const b = ids.get(dm.b)
    if (!a || !b || a === b) continue
    const userAId = a < b ? a : b
    const userBId = a < b ? b : a
    const lastAt = new Date(Date.now() - Math.min(...dm.messages.map((m) => m.minutesAgo)) * 60_000)
    const convId = newId()
    // v3 streak showcase: mochi<->luna have a 12-day streak (sakura theme unlocked)
    const isShowcase = (dm.a === 'mochi' && dm.b === 'luna') || (dm.a === 'luna' && dm.b === 'mochi')
    const streakDays = isShowcase ? 12 : Math.min(...dm.messages.map((m) => m.minutesAgo)) < 1440 ? 1 : 0
    await db.dMConversation.create({
      data: {
        id: convId, userAId, userBId, createdAt: hoursAgo(500), lastMessageAt: lastAt,
        streakDays,
        lastStreakDate: streakDays > 0 ? new Date(Date.now() - 3600_000) : null,
        streakNotified: isShowcase ? 12 : 0,
        themeKey: isShowcase ? 'sakura' : '',
      },
    })
    for (const msg of dm.messages) {
      const authorId = ids.get(msg.author)
      if (!authorId) continue
      await db.message.create({
        data: {
          id: newId(),
          scope: 'dm',
          conversationId: convId,
          authorId,
          content: msg.content,
          kind: 'text',
          createdAt: new Date(Date.now() - msg.minutesAgo * 60_000),
        },
      })
      messageCount++
    }
    dmCount++
  }
  console.log(`💌 DM conversations: ${dmCount} (messages included in count above: ${messageCount} total)`)

  // ---- welcome notifications ----
  const welcome = [
    'mochi', 'luna', 'pixel', 'whiskers', 'nala', 'simba', 'mika', 'oreo',
    'pepper', 'shadow', 'marmalade', 'tofu', 'muezza', 'pixel2', BOT_USERNAME,
  ]
  for (const username of welcome) {
    const uid = ids.get(username)
    if (!uid) continue
    await db.notification.create({
      data: {
        id: newId(),
        userId: uid,
        kind: 'system',
        title: 'Welcome to Meev! 🐱',
        body: 'Thanks for being part of the founding era. Explore servers, post something weird, and say hi to a stranger cat!',
        data: '{}',
        createdAt: hoursAgo(randInt(1, 48)),
      },
    })
  }
  console.log(`🔔 Welcome notifications: ${welcome.length}`)

  // ---- summary ----
  const [users, posts, likes, comments2, stories, follows, friends, servers, channels, messages, dms, notifications, gifts, badges, shopCatalog, userItems] = await Promise.all([
    db.user.count(), db.post.count(), db.like.count(), db.comment.count(), db.story.count(),
    db.follow.count(), db.friendRequest.count(), db.server.count(), db.channel.count(),
    db.message.count(), db.dMConversation.count(), db.notification.count(), db.giftCatalog.count(), db.badgeCatalog.count(),
    db.shopCatalog.count(), db.userItem.count(),
  ])
  console.log('\n================ SEED SUMMARY ================')
  console.log(`users=${users} (incl. meevbot)  posts=${posts}  likes=${likes}  comments=${comments2}`)
  console.log(`stories=${stories}  follows=${follows}  friendRequests=${friends}  servers=${servers}`)
  console.log(`channels=${channels}  messages=${messages}  dmConversations=${dms}  notifications=${notifications}`)
  console.log(`giftCatalog=${gifts}  badgeCatalog=${badges}  shopCatalog=${shopCatalog}  userItems=${userItems}`)
  console.log('Demo login: mochi / Meev1234! (also luna, pixel, shadow, … all demo users)')
  console.log('==============================================')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(() => {
    return db.$disconnect()
  })
