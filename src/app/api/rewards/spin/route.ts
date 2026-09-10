// MEEV — Weekly spin wheel (economy-protected): weighted prize draw
// capped at SPIN_MAX_COINS per week, 7-day cooldown, atomic claim +
// CoinLog ledger entry. (v16: coins ONLY — XP never comes from the wheel.)
// POST /api/rewards/spin → SpinResult | 400 { error: "SPIN_COOLDOWN", nextSpinAt }

import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { grantCoins } from '@/lib/meev/coins'
import { SPIN_PRIZES, SPIN_COOLDOWN_HOURS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COOLDOWN_MS = SPIN_COOLDOWN_HOURS * 60 * 60 * 1000

/** Weighted random pick — returns the index into SPIN_PRIZES. */
function pickPrizeIndex(): number {
  const total = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0)
  let roll = Math.random() * total
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    roll -= SPIN_PRIZES[i].weight
    if (roll <= 0) return i
  }
  return SPIN_PRIZES.length - 1
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user

    // cooldown check
    if (me.lastSpinAt) {
      const nextSpinAt = new Date(me.lastSpinAt.getTime() + COOLDOWN_MS)
      if (nextSpinAt.getTime() > Date.now()) {
        return Response.json({ error: 'SPIN_COOLDOWN', nextSpinAt: nextSpinAt.toISOString() }, { status: 400 })
      }
    }

    const prizeIndex = pickPrizeIndex()
    const prize = SPIN_PRIZES[prizeIndex]

    // atomic claim: burn the cooldown ONLY if it's still free — the
    // conditional update makes a double-tap race land 0 rows and the
    // request then reports the cooldown instead of paying twice
    const claimed = await db.user.updateMany({
      where: {
        id: me.id,
        OR: [{ lastSpinAt: null }, { lastSpinAt: { lt: new Date(Date.now() - COOLDOWN_MS) } }],
      },
      data: { lastSpinAt: new Date() },
    })
    if (claimed.count === 0) {
      return Response.json(
        { error: 'SPIN_COOLDOWN', nextSpinAt: new Date(Date.now() + COOLDOWN_MS).toISOString() },
        { status: 400 }
      )
    }

    // coins through the ledger (0-coin prizes log nothing)
    const coinsLeft = await grantCoins(me.id, prize.coins, 'daily_spin')

    return Response.json({
      prizeIndex,
      prize: { coins: prize.coins, label: prize.label, labelAr: prize.labelAr },
      coinsLeft,
      leveledUp: false,
      nextSpinAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}
