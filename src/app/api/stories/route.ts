import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { filterProfanity } from '@/lib/meev/profanity'
import { assertNotSuspended, enforceTextRules } from '@/lib/meev/moderation'
import { miniUser } from '@/lib/meev/dto'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { STORY_GRADIENTS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StoryItem = {
  id: string
  kind: string
  content: string
  gradient: string
  imageUrl: string | null
  createdAt: string
  expiresAt: string
  viewedByMe: boolean
  viewerCount?: number
}

function storyItem(
  s: { id: string; kind: string; content: string; gradient: string; imageUrl: string | null; createdAt: Date; expiresAt: Date; _count?: { views: number } },
  viewed: Set<string>,
): StoryItem {
  return {
    id: s.id,
    kind: s.kind,
    content: s.content,
    gradient: s.gradient,
    imageUrl: s.imageUrl,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    viewedByMe: viewed.has(s.id),
    ...(s._count ? { viewerCount: s._count.views } : {}),
  }
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const now = new Date()
    const stories = await db.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: { author: true, _count: { select: { views: true } } },
    })
    const mine = stories.filter((s) => s.authorId === me.id)
    const others = stories.filter((s) => s.authorId !== me.id)

    // viewed set for me
    const views = await db.storyView.findMany({ where: { userId: me.id }, select: { storyId: true } })
    const viewed = new Set(views.map((v) => v.storyId))

    // authors I follow first, then story recency
    const follows = await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })
    const followed = new Set(follows.map((f) => f.followingId))

    const byAuthor = new Map<string, typeof others>()
    for (const s of others) {
      const arr = byAuthor.get(s.authorId) || []
      arr.push(s)
      byAuthor.set(s.authorId, arr)
    }
    const groups = [...byAuthor.values()].map((authorStories) => ({
      authorStories,
      author: authorStories[0].author,
      newest: authorStories[0].createdAt.getTime(),
      followed: followed.has(authorStories[0].authorId),
    }))
    groups.sort((a, b) => {
      if (a.followed !== b.followed) return a.followed ? -1 : 1
      return b.newest - a.newest
    })

    return Response.json({
      groups: groups.map((grp) => ({
        author: miniUser(grp.author),
        stories: grp.authorStories.map((s) => storyItem(s, viewed)),
      })),
      // v15: my own watch-row (the Instagram ring-clearing view) must not
      // inflate MY viewerCount — the count is the audience, and I am not
      // my own audience
      myStories: mine.map((s) =>
        storyItem(
          { ...s, _count: { views: Math.max(0, (s._count?.views ?? 0) - (viewed.has(s.id) ? 1 : 0)) } },
          viewed,
        )
      ),
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    // v4 community rules: suspended users cannot share stories
    try {
      assertNotSuspended(me)
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 403 })
    }
    // v5 anti-flood: 6 stories per hour per user
    const rl = rateLimit(`stories:${me.id}`, 6, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)
    const body = await readJson(req)
    const kind = body.kind === 'image' ? 'image' : 'text'

    let imageUrl: string | null = null
    if (kind === 'image') {
      // v13 security pass: strict same-origin path whitelist (server-uploaded
      // ids or the curated /meev-media/ stock covers) — the old prefix-only
      // check accepted arbitrary tails (query strings, traversal-ish paths).
      const url = typeof body.imageUrl === 'string' ? body.imageUrl.split('?')[0] : ''
      if (!/^\/(uploads|meev-media)\/[A-Za-z0-9_-]+\.(webp|jpe?g|png|gif)$/.test(url)) {
        return badRequest('Image stories need a valid Meev image URL')
      }
      imageUrl = url
    }

    const content = sanitizeText(body.content, 'bio', 30) // v13: a pulse is ONE short sentence — 30 chars (user spec)
    if (kind === 'text' && content.length < 1) return badRequest('Text stories need some content')

    // v4 rule engine: self-harm / insult / spam ladders
    const verdict = await enforceTextRules(me.id, content)
    if (verdict.blocked) return badRequest(verdict.message || 'Not allowed')

    // profanity gate: soft words masked with 🙈, hard abuse rejected
    const filtered = filterProfanity(content)
    if (filtered.hard) {
      return badRequest('نعتذر، القصة تحتوي كلمات لا نقبلها 🙈 / This story contains words we cannot accept 🙈')
    }

    const gradient =
      typeof body.gradient === 'string' && STORY_GRADIENTS[body.gradient] ? body.gradient : 'sunset'

    const story = await db.story.create({
      data: {
        id: newId(),
        authorId: me.id,
        kind,
        content: filtered.text,
        gradient,
        imageUrl,
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    })
    // v16: no pulse XP — levels come only from interaction hours

    return Response.json({
      story: {
        id: story.id,
        kind: story.kind,
        content: story.content,
        gradient: story.gradient,
        imageUrl: story.imageUrl,
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
        viewedByMe: false,
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
