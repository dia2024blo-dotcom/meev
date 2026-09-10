import { db } from '@/lib/db'
import { guard, readJson, serverError, pageParam } from '@/lib/meev/guard'
import { publicUser } from '@/lib/meev/serialize'
import { INTERESTS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const INTEREST_KEYS = new Set(INTERESTS.map((i) => i.key))

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const body = await readJson(req)
    const url = new URL(req.url)
    const page = body.page !== undefined ? Math.max(1, Number(body.page) || 1) : pageParam(url)

    const q = typeof body.q === 'string' ? body.q.trim().slice(0, 60) : ''
    const interest = typeof body.interest === 'string' && INTEREST_KEYS.has(body.interest) ? body.interest : ''
    const online = body.online === true
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : ''

    // blocked either way → hidden from search
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
      select: { blockerId: true, blockedId: true },
    })
    const excluded = new Set<string>([me.id])
    for (const b of blocks) {
      excluded.add(b.blockerId)
      excluded.add(b.blockedId)
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
    const where: Record<string, unknown> = { id: { notIn: [...excluded] } }
    const and: Record<string, unknown>[] = []
    if (q) and.push({ OR: [{ username: { contains: q } }, { displayName: { contains: q } }] })
    if (online) {
      // approximate online: presence flag or seen in the last 5 minutes
      and.push({ OR: [{ presence: { not: 'offline' } }, { lastActiveAt: { gt: fiveMinAgo } }] })
    }
    if (city) where.city = { equals: city }
    if (interest) where.interests = { contains: `"${interest}"` }
    if (and.length > 0) where.AND = and

    const found = await db.user.findMany({
      where,
      orderBy: [{ lastActiveAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    })

    // friend/follower-aware privacy for nicer results
    const ids = found.map((u) => u.id)
    const [myFollows, theirFollows, friendReqs] = await Promise.all([
      db.follow.findMany({ where: { followerId: me.id, followingId: { in: ids } }, select: { followingId: true } }),
      db.follow.findMany({ where: { followerId: { in: ids }, followingId: me.id }, select: { followerId: true } }),
      db.friendRequest.findMany({
        where: { status: 'accepted', OR: [{ fromId: me.id, toId: { in: ids } }, { fromId: { in: ids }, toId: me.id }] },
        select: { fromId: true, toId: true },
      }),
    ])
    const connected = new Set<string>([
      ...myFollows.map((f) => f.followingId),
      ...theirFollows.map((f) => f.followerId),
      ...friendReqs.flatMap((f) => [f.fromId, f.toId]),
    ])

    return Response.json({
      users: found.map((u) => {
        const score =
          q === ''
            ? undefined
            : u.username === q.toLowerCase()
              ? 1
              : u.username.startsWith(q.toLowerCase()) || u.displayName.toLowerCase().startsWith(q.toLowerCase())
                ? 0.8
                : 0.5
        return { ...publicUser(u, { viewerIsFriendOrFollower: connected.has(u.id) }), ...(score !== undefined ? { score } : {}) }
      }),
    })
  } catch (err) {
    return serverError(err)
  }
}
