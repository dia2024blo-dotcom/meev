import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { awardXp } from '@/lib/meev/gamify'
import { levelFromXp } from '@/lib/meev/xp'
import { grantCoins } from '@/lib/meev/coins'
import { broadcast } from '@/lib/meev/realtime'
import { XP_PER_HOUR, COIN_TRICKLE_HOURS, COIN_TRICKLE_AMOUNT, LEVEL_UP_COIN_BONUS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const body = await readJson(req)
    const activeSeconds = Number(body.activeSeconds)
    if (!Number.isFinite(activeSeconds) || activeSeconds < 1 || activeSeconds > 60) {
      return badRequest('activeSeconds must be between 1 and 60')
    }

    const me = g.user
    // XP-INFLATION GUARD (1 XP / active hour is the spec): the client reports
    // up to 60 active seconds per beat, but the server only CREDITS time that
    // actually elapsed since the previous heartbeat. A spamming client (or a
    // second browser tab firing at the same moment) therefore accrues ~0 —
    // active time can never advance faster than real time.
    const elapsedSinceLast =
      me.lastHeartbeatAt !== null && me.lastHeartbeatAt !== undefined
        ? Math.max(0, Math.floor((Date.now() - me.lastHeartbeatAt.getTime()) / 1000))
        : Number.POSITIVE_INFINITY // first beat ever: take the client's word (≤60s)
    const credit = Math.min(Math.floor(activeSeconds), elapsedSinceLast)

    const total = me.activeSeconds + credit
    // v19 fix: award ONLY newly-completed hours. `hours` is the LIFETIME
    // hour count — awarding it directly re-credited a user's whole history
    // on every beat (a seeded demo account with ~2500 banked hours gained
    // +2500 XP per heartbeat). The delta below is the honest amount: XP for
    // hours completed since the previous beat only.
    const prevHours = Math.floor(me.activeSeconds / 3600)
    const hours = Math.floor(total / 3600)
    const newHours = hours - prevHours
    const remainder = total % 3600

    await db.user.update({
      where: { id: me.id },
      data: { activeSeconds: total, lastHeartbeatAt: new Date(), lastActiveAt: new Date() },
    })

    let xp = me.xp
    let level = levelFromXp(me.xp)
    let leveledUp = false
    let coinsCredited = 0
    let coinsLeft = me.coins

    if (newHours > 0) {
      // 1 XP per completed active hour — the ONLY XP source on Meev
      const result = await awardXp(me.id, newHours * XP_PER_HOUR, 'heartbeat_hour')
      xp = result.xp
      level = result.level
      leveledUp = result.leveledUp

      // ---- the hard-currency trickle (v16, deliberately scarce) ----
      // 1 coin per 6 completed interaction-hours (lifetime, idempotent by
      // construction: the hour count is monotonic) + 5 coins on level-up.
      const coinHoursBefore = Math.floor(me.xp / COIN_TRICKLE_HOURS)
      const coinHoursAfter = Math.floor(xp / COIN_TRICKLE_HOURS)
      const trickle = (coinHoursAfter - coinHoursBefore) * COIN_TRICKLE_AMOUNT
      if (trickle > 0) {
        try {
          coinsLeft = await grantCoins(me.id, trickle, 'activity_hours')
          coinsCredited += trickle
        } catch { /* ledger hiccup — never break the beat */ }
      }
      if (leveledUp) {
        try {
          coinsLeft = await grantCoins(me.id, LEVEL_UP_COIN_BONUS, 'level_up')
          coinsCredited += LEVEL_UP_COIN_BONUS
        } catch { /* best effort */ }
      }
      if (coinsCredited > 0) {
        await broadcast(`user:${me.id}`, 'coins:changed', { coins: coinsLeft, reason: 'activity', delta: coinsCredited })
      }
    }

    const interactions = Number(body.interactions)
    return Response.json({
      xp,
      level,
      coins: coinsLeft,
      coinsCredited,
      activeSeconds: total,
      leveledUp,
      nextHourProgress: remainder,
      ...(Number.isFinite(interactions) ? { interactions: Math.floor(interactions) } : {}),
    })
  } catch (err) {
    return serverError(err)
  }
}
