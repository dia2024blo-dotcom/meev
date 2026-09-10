import { db } from '@/lib/db'
import { guard, serverError, notFound } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const session = await db.session.findFirst({ where: { id, userId: g.user.id } })
    if (!session || session.revokedAt) return notFound('Session not found')

    await db.session.update({ where: { id }, data: { revokedAt: new Date() } })
    await db.refreshToken
      .updateMany({ where: { userId: g.user.id, sessionDevice: session.device, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => null)
    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
