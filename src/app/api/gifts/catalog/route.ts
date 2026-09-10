import { db } from '@/lib/db'
import { serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const gifts = await db.giftCatalog.findMany({ orderBy: { price: 'asc' } })
    return Response.json({
      gifts: gifts.map((g) => ({
        key: g.key,
        name: g.name,
        description: g.description,
        price: g.price,
        rarity: g.rarity,
        mood: g.mood,
        xpReward: g.xpReward,
      })),
    })
  } catch (err) {
    return serverError(err)
  }
}
