import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText, looksSuspicious } from '@/lib/meev/sanitize'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { filterProfanity } from '@/lib/meev/profanity'
import { assertNotSuspended, enforceTextRules } from '@/lib/meev/moderation'
import { postDto } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    // v4 community rules: suspended users cannot post
    try {
      assertNotSuspended(me)
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 403 })
    }
    // v5 anti-flood: 6 posts per hour per user (per user spec — no per-second/minute spam)
    const rl = rateLimit(`posts:${me.id}`, 6, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const content = sanitizeText(body.content, 'post')
    if (content.length < 1) return badRequest('Post content is required')

    // v4 rule engine: self-harm / insult / spam ladders (strikes + sanctions)
    const verdict = await enforceTextRules(me.id, content)
    if (verdict.blocked) return badRequest(verdict.message || 'Not allowed')

    // profanity gate: soft words are masked with 🙈 and still deliver,
    // hard abuse is rejected outright
    const filtered = filterProfanity(content)
    if (filtered.hard) {
      return badRequest('نعتذر، المنشور يحتوي كلمات لا نقبلها 🙈 / This post contains words we cannot accept 🙈')
    }
    const finalContent = filtered.text

    let imageUrl: string | null = null
    if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== '') {
      // v13 security: strict same-origin media whitelist (the old prefix-only
      // check accepted arbitrary 300-char tails — traversal/beacon risk)
      const url = (typeof body.imageUrl === 'string' ? body.imageUrl : '').split('?')[0]
      if (!/^\/(uploads|meev-media)\/[A-Za-z0-9_-]+\.(webp|jpe?g|png|gif)$/.test(url)) {
        return badRequest('Image URL must reference an uploaded Meev image')
      }
      imageUrl = url
    }

    const post = await db.post.create({
      data: {
        id: newId(),
        authorId: me.id,
        content: finalContent,
        imageUrl,
        kind: imageUrl ? 'image' : 'text',
      },
      include: { author: true, _count: { select: { likes: true, comments: true } } },
    })

    // v16: no post XP — levels come only from interaction hours
    await db.user.update({ where: { id: me.id }, data: { lastActiveAt: new Date() } }).catch(() => null)

    if (looksSuspicious(body.content)) {
      await db.auditLog
        .create({ data: { id: newId(), userId: me.id, action: 'suspicious_post', meta: JSON.stringify({ postId: post.id }) } })
        .catch(() => null)
    }

    return Response.json({ post: postDto(post, { likedByMe: false }) })
  } catch (err) {
    return serverError(err)
  }
}
