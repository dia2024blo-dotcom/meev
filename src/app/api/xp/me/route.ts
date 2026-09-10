import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { levelProgress } from '@/lib/meev/xp'
import { LEVEL_UNLOCKS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const xp = g.user.xp
    const progress = levelProgress(xp)
    const level = progress.level
    const unlocks = LEVEL_UNLOCKS.filter((u) => u.level <= level)
    const nextUnlock = LEVEL_UNLOCKS.find((u) => u.level > level) ?? null

    const pointsLog = await db.pointsLog.findMany({
      where: { userId: g.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { amount: true, reason: true, createdAt: true },
    })

    return Response.json({
      xp,
      level,
      progress,
      unlocks,
      nextUnlock,
      pointsLog: pointsLog.map((p) => ({ amount: p.amount, reason: p.reason, createdAt: p.createdAt.toISOString() })),
    })
  } catch (err) {
    return serverError(err)
  }
}
