import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest, notFound, forbidden, str, bool } from '@/lib/meev/guard'
import { CHAT_THEMES } from '@/lib/meev/constants'
import { createMessage, MessageError } from '@/lib/meev/messages'
import { broadcast } from '@/lib/meev/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/dms/[id]/settings — v3 chat settings.
 * Body: { themeKey?: string, muted?: boolean } → { ok, streakDays, themeKey, muted }
 * Participant-only. Themes must be unlocked by the conversation streak
 * (CHAT_THEMES.requiredStreak <= conv.streakDays). Mute is per-caller-side
 * (mutedA/mutedB). A theme change drops a celebratory system message into
 * the thread and pushes dm:new so the partner sees it live (best-effort).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    const body = await readJson(req)

    const conv = await db.dMConversation.findUnique({ where: { id } })
    if (!conv) return notFound('Conversation not found')
    const iAmA = conv.userAId === me.id
    if (!iAmA && conv.userBId !== me.id) {
      return forbidden('You are not a participant in this conversation')
    }

    const themeKey = str(body.themeKey)
    const muted = bool(body.muted)
    if (themeKey === undefined && muted === undefined) {
      return badRequest('Nothing to update — send themeKey and/or muted')
    }

    const data: Record<string, unknown> = {}

    if (themeKey !== undefined) {
      const theme = CHAT_THEMES.find((t) => t.key === themeKey)
      if (!theme) return badRequest('Unknown theme')
      if (theme.requiredStreak > conv.streakDays) {
        return badRequest(
          `Theme locked — keep the streak burning 🔥 (needs ${theme.requiredStreak} days, you have ${conv.streakDays})`
        )
      }
      data.themeKey = theme.key
    }
    if (muted !== undefined) data[iAmA ? 'mutedA' : 'mutedB'] = muted

    await db.dMConversation.update({ where: { id }, data })

    // theme change → celebratory system message + live push (best-effort:
    // the settings row itself is already saved at this point)
    if (themeKey !== undefined && themeKey !== conv.themeKey) {
      try {
        const theme = CHAT_THEMES.find((t) => t.key === themeKey)
        if (theme) {
          const partnerId = iAmA ? conv.userBId : conv.userAId
          const message = await createMessage({
            scope: 'dm',
            conversationId: id,
            authorId: me.id,
            content: `🎨 ${me.displayName} غيّر سمة المحادثة إلى ${theme.nameAr} / changed the chat theme to ${theme.name} ✨`,
            kind: 'system',
            processCommands: false,
          })
          await broadcast(`dm:${id}`, 'dm:new', { message, conversationId: id })
          await broadcast(`user:${partnerId}`, 'dm:new', { message, conversationId: id })
        }
      } catch {
        // system message is cosmetic — never fail the settings update
      }
    }

    const fresh = await db.dMConversation.findUniqueOrThrow({ where: { id } })
    return Response.json({
      ok: true,
      streakDays: fresh.streakDays,
      themeKey: fresh.themeKey,
      muted: iAmA ? fresh.mutedA : fresh.mutedB,
    })
  } catch (err) {
    if (err instanceof MessageError) {
      return Response.json({ error: err.message }, { status: err.status })
    }
    return serverError(err)
  }
}
