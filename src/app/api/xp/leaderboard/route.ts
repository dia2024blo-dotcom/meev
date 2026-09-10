import { db } from '@/lib/db'
import { serverError } from '@/lib/meev/guard'
import { miniUser } from '@/lib/meev/dto'
import { levelFromXp } from '@/lib/meev/xp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const top = await db.user.findMany({
      orderBy: { xp: 'desc' },
      take: 25,
    })
    return Response.json({
      entries: top.map((u) => ({ user: miniUser(u), xp: u.xp, level: levelFromXp(u.xp) })),
    })
  } catch (err) {
    return serverError(err)
  }
}
