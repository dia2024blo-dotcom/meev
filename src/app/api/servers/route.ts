import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { containsProfanity } from '@/lib/meev/profanity'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ServerListItem = {
  id: string
  name: string
  description: string
  iconEmoji: string
  accentColor: string
  isOfficial: boolean
  memberCount: number
  myRole: string | null
  channels: { id: string; name: string; topic: string; kind: string; position: number }[]
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const servers = await db.server.findMany({
      include: { members: { select: { userId: true, role: true } }, channels: { orderBy: { position: 'asc' } } },
    })

    const items: (ServerListItem & { mine: boolean })[] = servers.map((s) => {
      const mine = s.members.find((m) => m.userId === g.user.id)
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        iconEmoji: s.iconEmoji,
        accentColor: s.accentColor,
        isOfficial: s.isOfficial,
        memberCount: s.members.length,
        myRole: mine?.role ?? null,
        channels: s.channels.map((c) => ({ id: c.id, name: c.name, topic: c.topic, kind: c.kind, position: c.position })),
        mine: !!mine,
      }
    })

    // mine first, then bigger communities
    items.sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1
      return b.memberCount - a.memberCount
    })

    return Response.json({ servers: items.map(({ mine, ...rest }) => rest) })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const rl = rateLimit(`server-create:${g.user.id}`, 5, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const name = sanitizeText(body.name, 'displayName', 40)
    if (name.length < 2 || name.length > 40) return badRequest('Server name must be 2-40 characters')

    const description = sanitizeText(body.description, 'bio', 200)
    // community names/descriptions are public surfaces: any profanity level rejects
    if (containsProfanity(name) || containsProfanity(description)) {
      return badRequest('يرجى اختيار اسم ووصف لائقين 🙈 / Please pick a friendly name and description')
    }
    const iconEmoji = typeof body.iconEmoji === 'string' && body.iconEmoji.trim() ? body.iconEmoji.trim().slice(0, 8) : '🐱'
    const accentColor =
      typeof body.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentColor) ? body.accentColor : '#f04a6e'

    const server = await db.server.create({
      data: {
        id: newId(),
        name,
        description,
        iconEmoji,
        accentColor,
        ownerId: g.user.id,
        isOfficial: false,
      },
    })
    await db.serverMember.create({
      data: { id: newId(), serverId: server.id, userId: g.user.id, role: 'owner' },
    })
    const channelNames = ['general', 'introductions', 'random']
    for (let position = 0; position < channelNames.length; position++) {
      await db.channel.create({
        data: { id: newId(), serverId: server.id, name: channelNames[position], topic: '', kind: 'text', position },
      })
    }

    const channels = await db.channel.findMany({
      where: { serverId: server.id },
      orderBy: { position: 'asc' },
    })
    return Response.json({
      server: {
        id: server.id,
        name: server.name,
        description: server.description,
        iconEmoji: server.iconEmoji,
        accentColor: server.accentColor,
        isOfficial: server.isOfficial,
        memberCount: 1,
        myRole: 'owner',
        channels: channels.map((c) => ({ id: c.id, name: c.name, topic: c.topic, kind: c.kind, position: c.position })),
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
