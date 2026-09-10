// MEEV — XP / Leveling engine.
// Spec §6: 1 XP per active hour, 24 XP per level, cap at Level 999.

import { XP_PER_LEVEL, MAX_LEVEL } from './constants'

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 0
  return Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL))
}

export function xpForLevel(level: number): number {
  return level * XP_PER_LEVEL
}

export function levelProgress(xp: number): {
  level: number
  currentXp: number
  levelXp: number
  nextLevelXp: number
  intoLevel: number
  needed: number
  percent: number
  isMax: boolean
} {
  const level = levelFromXp(xp)
  const isMax = level >= MAX_LEVEL
  const levelXp = level * XP_PER_LEVEL
  const nextLevelXp = (level + 1) * XP_PER_LEVEL
  const intoLevel = xp - levelXp
  const needed = XP_PER_LEVEL
  return {
    level,
    currentXp: xp,
    levelXp,
    nextLevelXp,
    intoLevel,
    needed,
    percent: isMax ? 100 : Math.round((intoLevel / needed) * 100),
    isMax,
  }
}

/** XP awarded when crossing into a new level triggers unlocks check. */
export function newBadgesForLevel(level: number): string[] {
  const badges: string[] = []
  if (level >= 10) badges.push('lvl-10')
  if (level >= 50) badges.push('lvl-50')
  if (level >= 100) badges.push('lvl-100')
  if (level >= 999) badges.push('lvl-999')
  return badges
}
