// MEEV — Server → client DTO serializers (privacy-aware).

import type { User } from '@prisma/client'
import { levelProgress } from './xp'
import { parseInterests } from './similarity'
import { effectivePresence } from './dto'

export type PublicUser = {
  id: string
  username: string
  displayName: string
  avatarSeed: string
  bio: string
  city: string | null
  interests: string[]
  xp: number
  level: number
  coins: number
  presence: string
  nameColor: string
  role: string
  isBot: boolean
  isGuest: boolean
  // v5 staff/identity
  verified?: boolean
  customStatus?: string | null
  createdAt: string
  lastActiveAt: string
  email?: string
  emailVerified?: boolean
  privacy?: Record<string, string>
  stats?: { followers: number; following: number; posts: number; friends: number }
  badges?: { key: string; earnedAt: string }[]
  // v2
  avatarPhoto?: string | null
  nameGradient?: string
  frameKey?: string
  badgeShop?: string
  avatarAcc?: string
  // v3 cosmetics
  coverKey?: string
  profileEffect?: string
  avatarAnim?: boolean
  // v11: name-effect slot + level-999 legend cover photo
  nameFx?: string
  coverPhoto?: string | null
  lang?: 'ar' | 'en' | 'fr' | 'es' | 'tr' | 'de'
  lastSpinAt?: string | null
  // v4
  note?: string | null
  twoFactorEnabled?: boolean
  // v5 change locks (self only — drives the profile edit lock UI)
  nameChangedAt?: string | null
  interestsChangedAt?: string | null
}

export function publicUser(
  u: User,
  opts: {
    viewerIsSelf?: boolean
    viewerIsFriendOrFollower?: boolean
    stats?: { followers: number; following: number; posts: number; friends: number }
    badges?: { key: string; earnedAt: string }[]
  } = {}
): PublicUser {
  const privacy = JSON.parse(u.privacy || '{}') as Record<string, string>
  const viewer = opts.viewerIsSelf ? 'self' : opts.viewerIsFriendOrFollower ? 'friends' : 'public'
  const canSee = (field: string, def = 'everyone') => {
    const rule = privacy[field] || def
    if (rule === 'everyone' || viewer === 'self') return true
    // (self already returned true above — this branch is friends/public only)
    if (rule === 'friends') return viewer === 'friends'
    return false
  }
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarSeed: u.avatarSeed,
    bio: u.bio,
    city: canSee('location') ? u.city : null,
    interests: canSee('interests') ? parseInterests(u.interests) : [],
    xp: u.xp,
    level: levelProgress(u.xp).level,
    coins: u.coins,
    presence: canSee('presence') ? effectivePresence(u) : 'offline',
    nameColor: u.nameColor,
    role: u.role,
    isBot: u.isBot,
    isGuest: u.isGuest,
    // v5: verified badge (public) + custom status (public, like Discord)
    verified: !!u.verifiedAt,
    customStatus: u.customStatus ?? null,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt.toISOString(),
    email: opts.viewerIsSelf ? u.email : undefined,
    emailVerified: opts.viewerIsSelf ? !!u.emailVerifiedAt : undefined,
    privacy: opts.viewerIsSelf ? privacy : undefined,
    stats: opts.stats,
    badges: opts.badges,
    // v2 cosmetics + i18n (always public — they ARE the profile identity)
    avatarPhoto: u.avatarPhoto ?? null,
    nameGradient: u.nameGradient || '',
    frameKey: u.frameKey || '',
    badgeShop: u.badgeShop || '',
    avatarAcc: u.avatarAcc || '',
    coverKey: u.coverKey || '',
    profileEffect: u.profileEffect || '',
    avatarAnim: !!u.avatarAnim,
    // v11: the name-effect slot + the level-999 custom cover photo (public —
    // they are profile identity, same policy as the other cosmetics)
    nameFx: u.nameFx || '',
    coverPhoto: u.coverPhoto ?? null,
    lang: (['en', 'fr', 'es', 'tr', 'de'].includes(u.lang) ? u.lang : 'ar') as 'ar' | 'en' | 'fr' | 'es' | 'tr' | 'de',
    lastSpinAt: u.lastSpinAt ? u.lastSpinAt.toISOString() : null,
    // v4: note (public, Instagram-style) + 2FA flag (self only)
    note: u.note ?? null,
    twoFactorEnabled: opts.viewerIsSelf ? !!u.twoFactorEnabled : undefined,
    // v5: change-lock timestamps (self only)
    nameChangedAt: opts.viewerIsSelf ? (u.nameChangedAt ? u.nameChangedAt.toISOString() : null) : undefined,
    interestsChangedAt: opts.viewerIsSelf ? (u.interestsChangedAt ? u.interestsChangedAt.toISOString() : null) : undefined,
  }
}
