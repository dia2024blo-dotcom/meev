import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const body = await readJson(req)
    if (typeof body.enabled !== 'boolean') return badRequest('enabled (boolean) is required')

    const user = await db.user.update({ where: { id: g.user.id }, data: { twoFactorEnabled: body.enabled } })
    return Response.json({ ok: true, enabled: user.twoFactorEnabled })
  } catch (err) {
    return serverError(err)
  }
}
