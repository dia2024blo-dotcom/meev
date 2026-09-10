import { db } from '@/lib/db'
import { guard, readJson, serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const body = await readJson(req)
    const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === 'string') : null

    if (ids && ids.length > 0) {
      await db.notification.updateMany({
        where: { userId: g.user.id, id: { in: ids } },
        data: { read: true },
      })
    } else {
      await db.notification.updateMany({
        where: { userId: g.user.id, read: false },
        data: { read: true },
      })
    }

    const unread = await db.notification.count({ where: { userId: g.user.id, read: false } })
    return Response.json({ ok: true, unread })
  } catch (err) {
    return serverError(err)
  }
}
