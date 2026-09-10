import { db } from '@/lib/db'
import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'
import { sanitizeText } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const kind = typeof body.kind === 'string' ? body.kind.slice(0, 40) : ''
    const title = sanitizeText(body.title, 'title')
    if (!userId) return badRequest('userId is required')
    if (!kind || !title) return badRequest('kind and title are required')

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return notFound('User not found')

    await notifyUser(
      userId,
      kind,
      title,
      typeof body.body === 'string' ? sanitizeText(body.body, 'message') : '',
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {}
    )
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
