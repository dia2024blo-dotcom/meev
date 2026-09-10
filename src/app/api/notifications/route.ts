import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { notificationDto } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const [notifications, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: g.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.notification.count({ where: { userId: g.user.id, read: false } }),
    ])
    return Response.json({
      notifications: notifications.map(notificationDto),
      unread,
    })
  } catch (err) {
    return serverError(err)
  }
}
