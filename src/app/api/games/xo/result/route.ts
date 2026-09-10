import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    // v13 security pass — XP-farming guard: this endpoint is client-reported
    // (the XO board lives in the realtime service's memory), so a raw API
    // caller could otherwise claim `won:true` in a loop and mint game_win XP
    // at up to 120 claims/min. A real XO round takes well over 30s, and
    // nobody legitimately finishes more than 30 games/hour — the same shape
    // of cooldown/cap the arcade endpoint uses.
    const rlFast = rateLimit(`xo-fast:${me.id}`, 1, 30_000)
    if (!rlFast.ok) return rateLimitResponse(rlFast.retryAfter)
    const rlHour = rateLimit(`xo-hour:${me.id}`, 30, 3600_000)
    if (!rlHour.ok) return rateLimitResponse(rlHour.retryAfter)

    const body = await readJson(req)
    const opponentId = typeof body.opponentId === 'string' ? body.opponentId : ''
    if (!opponentId) return badRequest('opponentId is required')
    const won = body.won === true

    const opponent = await db.user.findUnique({ where: { id: opponentId } })
    if (!opponent) return notFound('Opponent not found')
    // v13: a self-opponent "game" is impossible in the realtime XO engine —
    // reject it instead of paying XP for it.
    if (opponent.id === me.id) return badRequest('You cannot play against yourself')

    // v16: games give glory only — XP comes from interaction hours

    // (opponent.id !== me.id is guaranteed above)
    await notifyUser(
      opponent.id,
      'match',
      `${me.displayName} ${won ? 'won' : 'played'} a Tic-Tac-Toe game with you`,
      won ? 'Rematch? 🎮' : 'Good game! 🎮',
      { opponentId: me.id, won }
    )

    return Response.json({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
