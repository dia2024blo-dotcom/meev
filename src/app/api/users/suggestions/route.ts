import { db } from '@/lib/db'
import { guard, serverError } from '@/lib/meev/guard'
import { publicUser } from '@/lib/meev/serialize'
import { parseInterests, similarityScore } from '@/lib/meev/similarity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** lastActiveAt hour ± 2h window (simple heuristic per contract). */
function hoursAround(date: Date): number[] {
  const h = date.getUTCHours()
  return [(h + 22) % 24, (h + 23) % 24, h, (h + 1) % 24, (h + 2) % 24]
}

function friendsFrom(rows: { fromId: string; toId: string; status: string }[], userId: string): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    if (r.status !== 'accepted') continue
    set.add(r.fromId === userId ? r.toId : r.fromId)
  }
  return set
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    const myInterests = parseInterests(me.interests)
    const myHours = hoursAround(me.lastActiveAt)

    // exclusion set: self, blocked either way, friends, pending requests either way
    const [blocks, myRequests] = await Promise.all([
      db.block.findMany({ where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] }, select: { blockerId: true, blockedId: true } }),
      db.friendRequest.findMany({
        where: { OR: [{ fromId: me.id }, { toId: me.id }] },
        select: { fromId: true, toId: true, status: true },
      }),
    ])
    const excluded = new Set<string>([me.id])
    for (const b of blocks) {
      excluded.add(b.blockerId)
      excluded.add(b.blockedId)
    }
    const myFriends = friendsFrom(myRequests, me.id)
    for (const r of myRequests) excluded.add(r.fromId === me.id ? r.toId : r.fromId)

    const candidates = await db.user.findMany({
      where: { id: { notIn: [...excluded] }, isBot: false, isGuest: false },
      take: 200,
    })
    if (candidates.length === 0) return Response.json({ users: [] })

    // build mutual-friend graph among candidates
    const candidateIds = candidates.map((c) => c.id)
    const theirRequests = await db.friendRequest.findMany({
      where: { status: 'accepted', OR: [{ fromId: { in: candidateIds } }, { toId: { in: candidateIds } }] },
      select: { fromId: true, toId: true, status: true },
    })
    const friendGraph = new Map<string, Set<string>>()
    for (const r of theirRequests) {
      const a = friendGraph.get(r.fromId) || new Set<string>()
      a.add(r.toId)
      friendGraph.set(r.fromId, a)
      const b = friendGraph.get(r.toId) || new Set<string>()
      b.add(r.fromId)
      friendGraph.set(r.toId, b)
    }

    const myInterestsSet = new Set(myInterests)
    const scored = candidates.map((c) => {
      const cInterests = parseInterests(c.interests)
      const mutualCount = [...myFriends].filter((f) => friendGraph.get(c.id)?.has(f)).length
      const sharedInterests = cInterests.filter((i) => myInterestsSet.has(i))
      const score = similarityScore(
        { interests: myInterests, city: me.city, myHours },
        {
          userId: c.id,
          interests: cInterests,
          city: c.city,
          mutualCount,
          myHours: myHours,
          theirHours: hoursAround(c.lastActiveAt),
        }
      )
      return {
        user: c,
        score: Math.round(score * 100) / 100,
        mutualCount,
        sharedInterests,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, 12)

    return Response.json({
      users: top.map((t) => ({
        ...publicUser(t.user, { viewerIsFriendOrFollower: false }),
        score: t.score,
        mutualCount: t.mutualCount,
        sharedInterests: t.sharedInterests,
      })),
    })
  } catch (err) {
    return serverError(err)
  }
}
