import { clearRefreshCookie, readRefreshCookie, revokeRefreshToken } from '@/lib/meev/auth'
import { serverError } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const raw = readRefreshCookie(req)
    if (raw) {
      await revokeRefreshToken(raw).catch(() => null)
    }
    const res = Response.json({ ok: true })
    clearRefreshCookie(res)
    return res
  } catch (err) {
    return serverError(err)
  }
}
