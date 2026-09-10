import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, notFound, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { filterProfanity } from '@/lib/meev/profanity'
import { assertNotSuspended, enforceTextRules } from '@/lib/meev/moderation'
import { notifyUser } from '@/lib/meev/realtime'
import { commentDto } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('Post not found')

    const comments = await db.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { author: true },
    })
    return Response.json({ comments: comments.map(commentDto) })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    // v4 community rules: suspended users cannot comment
    try {
      assertNotSuspended(me)
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 403 })
    }
    // comment spam gate: 20 comments / 5 minutes per user
    const rl = rateLimit(`comments:${me.id}`, 30, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } })
    if (!post) return notFound('Post not found')

    const body = await readJson(req)
    const content = sanitizeText(body.content, 'comment')
    if (content.length < 1) return badRequest('Comment content is required')

    // v4 rule engine: self-harm / insult / spam ladders
    const verdict = await enforceTextRules(me.id, content)
    if (verdict.blocked) return badRequest(verdict.message || 'Not allowed')

    // profanity gate: soft words masked with 🙈, hard abuse rejected
    const filtered = filterProfanity(content)
    if (filtered.hard) {
      return badRequest('نعتذر، التعليق يحتوي كلمات لا نقبلها 🙈 / This comment contains words we cannot accept 🙈')
    }
    const finalContent = filtered.text

    const comment = await db.comment.create({
      data: { id: newId(), postId: id, authorId: me.id, content: finalContent },
      include: { author: true },
    })

    // v16: no comment XP — levels come only from interaction hours
    if (post.authorId !== me.id) {
      await notifyUser(
        post.authorId,
        'comment',
        `${me.displayName} commented on your post`,
        finalContent.slice(0, 120),
        { postId: id, commentId: comment.id, userId: me.id, username: me.username }
      )
    }

    return Response.json({ comment: commentDto(comment) })
  } catch (err) {
    return serverError(err)
  }
}
