// MEEV v6 — Instagram-style story interactions.
// POST /api/stories/:id/react { emoji } or { text } →
//   Reacting/replying to a friend's story lands in the DM with that friend,
//   exactly like Instagram: a story-preview message + the emoji / reply text.
// The story is also marked as viewed (a reaction implies a view).

import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest, notFound } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { filterProfanity } from '@/lib/meev/profanity'
import { createMessage, MessageError } from '@/lib/meev/messages'
import { notifyUser } from '@/lib/meev/realtime'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Instagram's quick reaction set (single grapheme emojis only). */
const QUICK_REACTIONS = new Set(['❤️', '😂', '🔥', '😮', '😢', '👏', '💯', '😍'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    // interactions are light but capped: 30 / hour
    const rl = rateLimit(`story-react:${me.id}`, 30, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const story = await db.story.findUnique({ where: { id } })
    if (!story || story.expiresAt <= new Date()) return notFound('Story not found')
    if (story.authorId === me.id) {
      return badRequest('لا يمكن التفاعل مع قصتك الخاصة / You cannot react to your own story')
    }

    const body = await readJson(req)
    // canonicalize the emoji: only known quick reactions are accepted (this
    // also normalizes ❤ vs ❤️ variation selectors → the stored content is
    // always a clean set member)
    const rawEmoji = typeof body.emoji === 'string' ? body.emoji.trim() : ''
    const firstCp = [...rawEmoji][0] || ''
    const member = QUICK_REACTIONS.has(rawEmoji)
      ? rawEmoji
      : [...QUICK_REACTIONS].find((e) => e.startsWith(firstCp))
    const emoji = member && rawEmoji.length <= 8 ? member : ''
    const isReaction = emoji !== ''

    // a reply (text) — filtered like any other message text
    let text = ''
    if (!isReaction) {
      if (typeof body.text !== 'string' || body.text.trim().length === 0) {
        return badRequest('emoji أو text مطلوب / an emoji or a reply text is required')
      }
      const filtered = filterProfanity(sanitizeText(body.text, 'message', 500))
      if (filtered.hard) {
        return badRequest('نعتذر، ردّك على القصة يحتوي كلمات لا نقبلها 🙈 / Your reply contains words we cannot accept 🙈')
      }
      text = filtered.text
      if (!text) return badRequest('الرد فارغ / The reply is empty')
    }

    const author = await db.user.findUnique({ where: { id: story.authorId } })
    if (!author) return notFound('Story author not found')

    // reacting = viewing
    await db.storyView.upsert({
      where: { storyId_userId: { storyId: id, userId: me.id } },
      create: { id: newId(), storyId: id, userId: me.id },
      update: {},
    }).catch(() => null)

    // find-or-create the DM with the story author (deterministic ordering)
    const userAId = me.id < author.id ? me.id : author.id
    const userBId = me.id < author.id ? author.id : me.id
    let conv = await db.dMConversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } })
    if (!conv) {
      conv = await db.dMConversation.create({ data: { id: newId(), userAId, userBId } })
    }

    // the message: kind "story_react", content = emoji or reply text,
    // meta = a compact story preview + what kind of interaction it was
    const storyPreview = {
      id: story.id,
      kind: story.kind,
      gradient: story.gradient,
      content: story.content.slice(0, 90),
      imageUrl: story.kind === 'image' ? story.imageUrl : null,
    }

    const dto = await createMessage({
      scope: 'dm',
      conversationId: conv.id,
      authorId: me.id,
      kind: 'story_react',
      content: isReaction ? emoji : text,
      meta: { story: storyPreview, reply: !isReaction },
    })

    // live delivery to both sides (this route bypasses the socket pipeline)
    try {
      const { broadcast } = await import('@/lib/meev/realtime')
      await broadcast(`dm:${conv.id}`, 'dm:new', { message: dto, conversationId: conv.id })
      await broadcast(`user:${author.id}`, 'dm:new', { message: dto, conversationId: conv.id })
      await broadcast(`user:${me.id}`, 'dm:new', { message: dto, conversationId: conv.id })
    } catch {
      // delivery is best-effort — the message is already persisted
    }

    // let the author know, Instagram-style
    await notifyUser(
      author.id,
      'system',
      isReaction
        ? `${me.displayName} تفاعل مع قصتك ${emoji}`
        : `${me.displayName} ردّ على قصتك`,
      storyPreview.content ? `«${storyPreview.content}»` : '',
      { conversationId: conv.id, storyId: story.id },
    ).catch(() => null)

    return Response.json({
      ok: true,
      conversationId: conv.id,
      message: dto,
    })
  } catch (err) {
    if (err instanceof MessageError) {
      return Response.json({ error: err.message }, { status: err.status })
    }
    return serverError(err)
  }
}
