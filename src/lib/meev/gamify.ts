// MEEV — Gamification engine: award XP, write PointsLog, detect level-ups,
// grant level badges, notify + broadcast on level-up.

import { db } from '@/lib/db'
import { newId } from './ids'
import { levelFromXp, newBadgesForLevel } from './xp'
import { broadcast } from './realtime'

export type XpResult = {
  xp: number
  level: number
  leveledUp: boolean
  newLevel: number
}

/**
 * Award XP to a user. Writes a PointsLog entry, detects level-ups,
 * grants new level badges (lvl-10/50/100/999), creates a 'level_up'
 * Notification and broadcasts `level:up` to room `user:<id>`.
 */
export async function awardXp(userId: string, amount: number, reason: string): Promise<XpResult> {
  const amt = Math.max(0, Math.round(amount))
  if (amt === 0) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { xp: true } })
    return { xp: u?.xp ?? 0, level: levelFromXp(u?.xp ?? 0), leveledUp: false, newLevel: levelFromXp(u?.xp ?? 0) }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amt } },
    select: { xp: true },
  })
  const xp = updated.xp
  const beforeLevel = levelFromXp(xp - amt)
  const newLevel = levelFromXp(xp)

  await db.pointsLog.create({
    data: { id: newId(), userId, amount: amt, reason },
  })

  const leveledUp = newLevel > beforeLevel
  if (leveledUp) {
    // auto-grant level badges
    const badgeKeys = newBadgesForLevel(newLevel)
    for (const badgeKey of badgeKeys) {
      try {
        await db.userBadge.create({ data: { id: newId(), userId, badgeKey } })
      } catch {
        // already owned — P2002 unique constraint
      }
    }
    await db.notification.create({
      data: {
        id: newId(),
        userId,
        kind: 'level_up',
        title: `Level ${newLevel} reached! 🎉`,
        body: newLevel >= 999 ? 'You are now a MEEV LEGEND. 👑' : 'Keep being awesome — new perks may have unlocked.',
        data: JSON.stringify({ level: newLevel, xp }),
      },
    })
    await broadcast(`user:${userId}`, 'level:up', { level: newLevel, xp })
  }

  return { xp, level: newLevel, leveledUp, newLevel }
}
