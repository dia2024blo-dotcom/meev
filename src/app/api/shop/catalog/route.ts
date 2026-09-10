import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// item.type -> User column that holds the exclusive cosmetic slot
// (v3-complete: name_color / profile_effect / cover were missing here before,
//  which made the catalog report equipped:false for equipped v3 items)
const SLOT_COLUMN: Record<string, string> = {
  name_gradient: 'nameGradient',
  name_color: 'nameColor',
  frame: 'frameKey',
  badge: 'badgeShop',
  accessory: 'avatarAcc',
  profile_effect: 'profileEffect',
  cover: 'coverKey',
}
// animated_avatar → boolean avatarAnim flag (single legendary item)
const ANIM_AVATAR_KEY = 'aa-legend'

function parsePayload(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// ---------------- catalog cache (speed pass, task 12-c) ----------------
// The 52 catalog rows are effectively static (only change on shop edits /
// reseeds) — the parsed rows are cached process-wide for 60s. The per-user
// overlay (owned / equipped) is computed FRESH on every request.
type CatalogItem = {
  key: string
  type: string
  name: string
  description: string
  price: number
  rarity: string
  payload: Record<string, unknown>
  levelRequired: number
  xpReward: number
}

const CATALOG_TTL_MS = 60_000
let catalogCache: { items: CatalogItem[]; at: number } | null = null

async function catalogItems(): Promise<CatalogItem[]> {
  const now = Date.now()
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.items
  const rows = await db.shopCatalog.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { price: 'asc' }] })
  const items: CatalogItem[] = rows.map((r) => ({
    key: r.key,
    type: r.type,
    name: r.name,
    description: r.description,
    price: r.price,
    rarity: r.rarity,
    payload: parsePayload(r.payload),
    levelRequired: r.levelRequired,
    xpReward: r.xpReward,
  }))
  catalogCache = { items, at: now }
  return items
}

/** ShopItemDTO[] for the given user: owned from UserItem rows, equipped from User slot columns. */
export async function shopCatalogFor(userId: string, user: Record<string, unknown>) {
  const [items, owned] = await Promise.all([
    catalogItems(),
    db.userItem.findMany({ where: { userId }, select: { itemKey: true } }),
  ])
  const ownedSet = new Set(owned.map((o) => o.itemKey))
  return items.map((r) => {
    if (r.type === 'animated_avatar') {
      return { ...r, owned: ownedSet.has(r.key), equipped: r.key === ANIM_AVATAR_KEY && !!user.avatarAnim }
    }
    const column = SLOT_COLUMN[r.type]
    const slotValue = column ? (user[column] as string | undefined) : undefined
    return {
      ...r,
      owned: ownedSet.has(r.key),
      equipped: !!slotValue && slotValue === r.key,
    }
  })
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const items = await shopCatalogFor(g.user.id, g.user as unknown as Record<string, unknown>)
    return Response.json({ items })
  } catch (err) {
    return serverError(err)
  }
}
