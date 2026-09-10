import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { giftDto } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const catalogs = await db.giftCatalog.findMany()
    const catalogMap = new Map(catalogs.map((c) => [c.key, c]))

    const [sent, received] = await Promise.all([
      db.gift.findMany({
        where: { senderId: g.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { sender: true, recipient: true },
      }),
      db.gift.findMany({
        where: { recipientId: g.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { sender: true, recipient: true },
      }),
    ])

    return Response.json({
      sent: sent.map((gift) => giftDto(gift, catalogMap.get(gift.giftKey) ?? null)),
      received: received.map((gift) => giftDto(gift, catalogMap.get(gift.giftKey) ?? null)),
    })
  } catch (err) {
    return serverError(err)
  }
}
