import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'
import { levelFromXp } from '@/lib/meev/xp'
import { spendCoins, CoinError } from '@/lib/meev/coins'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePayload(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const body = await readJson(req)
    const itemKey = typeof body.itemKey === 'string' ? body.itemKey : ''
    if (!itemKey) return badRequest('itemKey is required')

    const item = await db.shopCatalog.findUnique({ where: { key: itemKey } })
    if (!item || !item.active) return notFound('Item not found')

    // fresh read — coins may have moved since the token was issued
    const me = await db.user.findUniqueOrThrow({ where: { id: g.user.id } })

    const existing = await db.userItem.findUnique({
      where: { userId_itemKey: { userId: me.id, itemKey } },
    })
    if (existing) return badRequest('You already own this item')

    if (levelFromXp(me.xp) < item.levelRequired) {
      return badRequest(`Unlocks at level ${item.levelRequired} — keep leveling up! 🐾`)
    }
    if (me.coins < item.price) {
      return Response.json({ error: 'Not enough Gold Meev 🪙 — send gifts, spin weekly and level up to earn more!' }, { status: 400 })
    }

    // RACE HARDENING (double-purchase): the UserItem unique constraint is the
    // atomic claim. Claiming FIRST means a concurrent twin request fails here
    // (P2002 → clean 400) BEFORE any coins move; the coin spend follows and a
    // failed spend rolls the claim back — coins can never leave without the item.
    const claimedId = newId()
    try {
      await db.userItem.create({
        data: { id: claimedId, userId: me.id, itemKey, equipped: false },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return badRequest('You already own this item')
      }
      throw err
    }

    try {
      // atomic deduct (conditional UPDATE → no double-spend races) + ledger
      await spendCoins(me.id, item.price, 'shop_purchase', item.key)
    } catch (err) {
      if (err instanceof CoinError) {
        // balance changed between the pre-check and the spend — roll back the claim
        await db.userItem.delete({ where: { id: claimedId } }).catch(() => null)
        return Response.json({ error: 'Not enough Gold Meev 🪙 — send gifts, spin weekly and level up to earn more!' }, { status: 400 })
      }
      throw err
    }

    // (v16: shop purchases grant the item only — no XP, ever)

    // wardrobe notification (best-effort)
    await notifyUser(
      me.id,
      'system',
      'New item unlocked in your wardrobe! ✨',
      `${item.name} is now yours — equip it from the shop.`,
      { itemKey: item.key, item: item.name }
    ).catch(() => null)

    // authoritative post-purchase state
    const fresh = await db.user.findUniqueOrThrow({ where: { id: me.id } })
    const level = levelFromXp(fresh.xp)

    return Response.json({
      item: {
        key: item.key,
        type: item.type,
        name: item.name,
        description: item.description,
        price: item.price,
        rarity: item.rarity,
        payload: parsePayload(item.payload),
        levelRequired: item.levelRequired,
        xpReward: item.xpReward,
        owned: true,
        equipped: false,
      },
      coinsLeft: fresh.coins,
      level,
      leveledUp: false,
    })
  } catch (err) {
    if (err instanceof CoinError) {
      return Response.json({ error: 'Not enough Gold Meev 🪙 — send gifts, spin weekly and level up to earn more!' }, { status: 400 })
    }
    return serverError(err)
  }
}
