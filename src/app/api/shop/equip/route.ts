import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { selfUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// item.type -> User column that holds the exclusive cosmetic slot.
// The column IS the slot: equipping sets it to the item key, unequipping clears it.
// name_color: the nameColor column holds either a raw hex (free palette)
// or an item key ("nc-*") — the frontend resolves keys against SHOP_ITEMS.
const SLOT_COLUMN: Record<string, string> = {
  name_gradient: 'nameGradient',
  name_color: 'nameColor',
  name_effect: 'nameFx', // v11: the name-effect slot (nf-*)
  frame: 'frameKey',
  badge: 'badgeShop',
  accessory: 'avatarAcc',
  profile_effect: 'profileEffect',
  cover: 'coverKey',
}
// animated_avatar → the boolean avatarAnim flag (single legendary item)
const ANIM_AVATAR_KEY = 'aa-legend'

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
    const equipped = body.equipped !== false
    if (!itemKey) return badRequest('itemKey is required')

    const item = await db.shopCatalog.findUnique({ where: { key: itemKey } })
    if (!item || !item.active) return notFound('Item not found')

    const owned = await db.userItem.findUnique({
      where: { userId_itemKey: { userId: g.user.id, itemKey } },
    })
    if (!owned) return badRequest('You do not own this item')

    // set / clear the exclusive slot column (or the avatarAnim flag)
    let updated
    if (item.type === 'animated_avatar') {
      updated = await db.user.update({
        where: { id: g.user.id },
        data: { avatarAnim: equipped },
      })
    } else {
      const column = SLOT_COLUMN[item.type]
      if (!column) return badRequest('Unknown cosmetic type')
      updated = await db.user.update({
        where: { id: g.user.id },
        data: { [column]: equipped ? itemKey : '' },
      })
    }

    // sync UserItem.equipped flags within this slot type (exclusive per type)
    const typeRows = await db.shopCatalog.findMany({ where: { type: item.type }, select: { key: true } })
    await db.userItem.updateMany({
      where: { userId: g.user.id, itemKey: { in: typeRows.map((t) => t.key) } },
      data: { equipped: false },
    })
    if (equipped) {
      await db.userItem.update({ where: { id: owned.id }, data: { equipped: true } })
    }

    // full refreshed catalog + fresh self DTO
    const [rows, ownedRows] = await Promise.all([
      db.shopCatalog.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { price: 'asc' }] }),
      db.userItem.findMany({ where: { userId: g.user.id }, select: { itemKey: true } }),
    ])
    const ownedSet = new Set(ownedRows.map((o) => o.itemKey))
    const user = updated as unknown as Record<string, unknown>
    const items = rows.map((r) => {
      if (r.type === 'animated_avatar') {
        return {
          key: r.key,
          type: r.type,
          name: r.name,
          description: r.description,
          price: r.price,
          rarity: r.rarity,
          payload: parsePayload(r.payload),
          levelRequired: r.levelRequired,
          xpReward: r.xpReward,
          owned: ownedSet.has(r.key),
          equipped: !!user.avatarAnim,
        }
      }
      const col = SLOT_COLUMN[r.type]
      const slotValue = col ? (user[col] as string | undefined) : undefined
      return {
        key: r.key,
        type: r.type,
        name: r.name,
        description: r.description,
        price: r.price,
        rarity: r.rarity,
        payload: parsePayload(r.payload),
        levelRequired: r.levelRequired,
        xpReward: r.xpReward,
        owned: ownedSet.has(r.key),
        equipped: !!slotValue && slotValue === r.key,
      }
    })

    return Response.json({ items, user: await selfUser(updated) })
  } catch (err) {
    return serverError(err)
  }
}
