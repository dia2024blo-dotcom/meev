import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, notFound, forbidden, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { containsProfanity } from '@/lib/meev/profanity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAFF_ROLES = new Set(['owner', 'admin', 'mod'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const { id } = await ctx.params
    const server = await db.server.findUnique({ where: { id } })
    if (!server) return notFound('Server not found')

    const membership = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: g.user.id } },
    })
    if (!membership || !STAFF_ROLES.has(membership.role)) {
      return forbidden('Only the owner, admins and mods can create channels')
    }

    const body = await readJson(req)
    const rawName = typeof body.name === 'string' ? body.name : ''
    const name = rawName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    if (name.length < 2 || name.length > 24) {
      return badRequest('Channel name must be 2-24 lowercase letters, numbers or hyphens')
    }

    const topic = sanitizeText(body.topic, 'subject', 120)
    // channel names + topics are public surfaces: any profanity level rejects
    if (containsProfanity(name) || containsProfanity(topic)) {
      return badRequest('يرجى اختيار اسم قناة لائق 🙈 / Please pick a friendly channel name')
    }

    const duplicate = await db.channel.findUnique({ where: { serverId_name: { serverId: id, name } } })
    if (duplicate) return badRequest('A channel with that name already exists')

    const kind = body.kind === 'voice' ? 'voice' : 'text'

    const lastChannel = await db.channel.findFirst({
      where: { serverId: id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const channel = await db.channel.create({
      data: {
        id: newId(),
        serverId: id,
        name,
        topic,
        kind,
        position: (lastChannel?.position ?? -1) + 1,
      },
    })

    return Response.json({
      channel: {
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        kind: channel.kind,
        position: channel.position,
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
