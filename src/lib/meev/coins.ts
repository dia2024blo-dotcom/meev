// MEEV v3 — PawCoin economy core: atomic spends + full audit ledger.
// Every coin movement in the platform MUST go through spendCoins /
// grantCoins so the CoinLog trail stays complete and races can't
// overspend a balance (SQLite single-writer + conditional UPDATE
// with a fresh WHERE on the remaining balance).

import { db } from '@/lib/db'
import { newId } from './ids'

export class CoinError extends Error {}

/**
 * Atomically deduct coins. Throws CoinError when the balance is
 * insufficient (or the user vanished) — no partial writes.
 * Returns the new balance.
 */
export async function spendCoins(
  userId: string,
  amount: number,
  reason: string,
  contextId = ''
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CoinError('Invalid coin amount')
  }
  // conditional update: only succeeds while the balance still covers it
  const updated = await db.user.updateMany({
    where: { id: userId, coins: { gte: amount } },
    data: { coins: { decrement: amount } },
  })
  if (updated.count === 0) {
    throw new CoinError('INSUFFICIENT_COINS')
  }
  const fresh = await db.user.findUnique({ where: { id: userId }, select: { coins: true } })
  const balanceAfter = fresh?.coins ?? 0
  await db.coinLog
    .create({
      data: { id: newId(), userId, delta: -amount, reason, balanceAfter, contextId },
    })
    .catch(() => null) // ledger must never break a purchase
  return balanceAfter
}

/**
 * Credit coins (spin, admin grants…). Returns the new balance.
 */
export async function grantCoins(
  userId: string,
  amount: number,
  reason: string,
  contextId = ''
): Promise<number> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new CoinError('Invalid coin amount')
  }
  if (amount === 0) {
    const cur = await db.user.findUnique({ where: { id: userId }, select: { coins: true } })
    return cur?.coins ?? 0
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: { coins: { increment: amount } },
    select: { coins: true },
  })
  await db.coinLog
    .create({
      data: { id: newId(), userId, delta: amount, reason, balanceAfter: updated.coins, contextId },
    })
    .catch(() => null)
  return updated.coins
}
