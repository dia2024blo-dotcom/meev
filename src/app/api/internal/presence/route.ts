import { db } from '@/lib/db'
import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { PRESENCE } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const presence = typeof body.presence === 'string' ? body.presence : ''
    if (!userId) return badRequest('userId is required')
    if (!(presence in PRESENCE)) return badRequest('Invalid presence status')

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return notFound('User not found')

    // v6 real presence: presence changes also prove liveness (socket connect /
    // status change) — keep lastActiveAt fresh so the 3-minute staleness gate
    // never marks a live socket user offline between heartbeats.
    const isOffline = presence === 'offline'
    await db.user.update({
      where: { id: userId },
      data: isOffline ? { presence } : { presence, lastActiveAt: new Date() },
    })
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
