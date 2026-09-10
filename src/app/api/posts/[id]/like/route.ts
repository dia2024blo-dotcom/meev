import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, notFound, readJson } from '@/lib/meev/guard'
import { notifyUser } from '@/lib/meev/realtime'
import { emptyReactionCounts } from '@/lib/meev/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = new Set(['like', 'love', 'care', 'laugh', 'wow', 'sad', 'angry'])

/** Per-kind counts + total for one post (small map query). */
async function countsFor(postId: string) {
  const rows = await db.like.groupBy({
    by: ['kind'],
    where: { postId },
    _count: { _all: true },
  })
  const counts = emptyReactionCounts()
  for (const row of rows) {
    if (KINDS.has(row.kind)) counts[row.kind as keyof typeof counts] = row._count._all
    else counts.like = row._count._all
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { counts, total }
}

/**
 * v13 — Facebook-style reactions (v16: the full 7-emoji set).
 * POST { kind?: 'like'|'love'|'care'|'laugh'|'wow'|'sad'|'angry' } (default 'like'):
 *   - no reaction yet      → create with kind (author notify, initial only)
 *   - existing, same kind  → DELETE (toggle off → { liked: false })
 *   - existing, other kind → UPDATE to the new kind
 * (v16: reactions never award XP — levels come from interaction hours.)
 * Response: { liked, kind, counts, total }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } })
    if (!post) return notFound('Post not found')

    const body = await readJson(req)
    const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : 'like'

    const existing = await db.like.findUnique({
      where: { postId_userId: { postId: id, userId: me.id } },
    })

    if (!existing) {
      // new reaction — notify the author (initial only).
      // v16: reactions give no XP — levels come only from interaction hours.
      await db.like.create({ data: { id: newId(), postId: id, userId: me.id, kind } })
      if (post.authorId !== me.id) {
        await notifyUser(
          post.authorId,
          'like',
          `${me.displayName} reacted to your post`,
          '',
          { postId: id, userId: me.id, username: me.username, kind }
        )
      }
    } else if (existing.kind === kind) {
      // same reaction again → toggle off
      await db.like.delete({ where: { id: existing.id } }).catch(() => null)
      const { counts, total } = await countsFor(id)
      return Response.json({ liked: false, kind: null, counts, total })
    } else {
      // different reaction → switch (no extra XP/notify)
      await db.like.update({ where: { id: existing.id }, data: { kind } }).catch(() => null)
    }

    const { counts, total } = await countsFor(id)
    return Response.json({ liked: true, kind, counts, total })
  } catch (err) {
    return serverError(err)
  }
}

/** DELETE removes whatever reaction I have on the post. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const post = await db.post.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('Post not found')

    await db.like.deleteMany({ where: { postId: id, userId: g.user.id } }).catch(() => null)
    const { counts, total } = await countsFor(id)
    return Response.json({ liked: false, kind: null, counts, total })
  } catch (err) {
    return serverError(err)
  }
}
