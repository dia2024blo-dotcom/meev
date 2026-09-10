import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { hashPassword, setRefreshCookie } from '@/lib/meev/auth'
import { issueAuth } from '@/lib/meev/auth-flow'
import { serverError } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { AVATAR_GRADIENTS, CAT_PALETTE } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PALETTES = Object.keys(CAT_PALETTE)
const GRADIENTS = Object.keys(AVATAR_GRADIENTS)

function randomAvatarSeed(): string {
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)]
  const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]
  const variant = Math.floor(Math.random() * 4)
  return `${palette}|${gradient}|${variant}`
}

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`guest:${clientIp(req)}`, 5, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    // unique guest handle
    let username = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const rand = crypto.randomBytes(4).toString('hex')
      const candidate = `guest_${rand}`
      const exists = await db.user.findUnique({ where: { username: candidate }, select: { id: true } })
      if (!exists) {
        username = candidate
        break
      }
    }
    if (!username) return serverError()

    const password = crypto.randomBytes(24).toString('hex') + '!Aa1'
    const user = await db.user.create({
      data: {
        id: newId(),
        username,
        email: `${username}@meev.local`,
        displayName: `Guest ${username.slice(6, 10).toUpperCase()}`,
        passwordHash: hashPassword(password),
        avatarSeed: randomAvatarSeed(),
        isGuest: true,
        coins: 500,
      },
    })

    const payload = await issueAuth(user, req)
    const res = Response.json({
      user: payload.user,
      accessToken: payload.accessToken,
      expiresIn: payload.expiresIn,
    })
    setRefreshCookie(res, payload.rawRefresh)
    return res
  } catch (err) {
    return serverError(err)
  }
}
