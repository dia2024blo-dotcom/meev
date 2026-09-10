import { guard, serverError } from '@/lib/meev/guard'
import { selfUser } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    return Response.json({ user: await selfUser(g.user) })
  } catch (err) {
    return serverError(err)
  }
}
