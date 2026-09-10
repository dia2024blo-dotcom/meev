import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * (v16) RETIRED on purpose: XP is granted exclusively by the interaction
 * heartbeat (1 point per completed active hour). No service may mint XP.
 * The endpoint stays up as an explicit 410 so any old caller fails loudly
 * instead of silently changing user levels.
 */
export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    await readJson(req)
    return Response.json(
      {
        error: 'GONE — XP can only accrue through the hourly interaction heartbeat (1 point per active hour).',
      },
      { status: 410 },
    )
  } catch (err) {
    return serverError(err)
  }
}

export async function GET() {
  return Response.json(
    { error: 'GONE — XP can only accrue through the hourly interaction heartbeat (1 point per active hour).' },
    { status: 410 },
  )
}
