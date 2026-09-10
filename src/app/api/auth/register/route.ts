import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { checkPasswordStrength, hashPassword, newOtp, setRefreshCookie } from '@/lib/meev/auth'
import { issueAuth } from '@/lib/meev/auth-flow'
import { readJson, serverError, badRequest } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { sanitizeEmail, sanitizeText, sanitizeUsername } from '@/lib/meev/sanitize'
import { containsProfanity } from '@/lib/meev/profanity'
import { AVATAR_GRADIENTS, CAT_PALETTE, INTERESTS } from '@/lib/meev/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INTEREST_KEYS = new Set(INTERESTS.map((i) => i.key))
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
    const ip = clientIp(req)
    const rl = rateLimit(`register:${ip}`, 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const username = sanitizeUsername(body.username)
    if (!/^[a-z0-9._]{3,24}$/.test(username)) {
      return badRequest('Username must be 3-24 characters (lowercase letters, numbers, dots, underscores)')
    }
    // friendly names only — reject soft AND hard profanity in identifiers
    if (containsProfanity(username) || containsProfanity(typeof body.displayName === 'string' ? body.displayName : '')) {
      return badRequest('يرجى اختيار اسم لائق 🙈 / Please pick a friendly name')
    }
    const email = sanitizeEmail(body.email)
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return badRequest('Please provide a valid email address')
    }
    const password = typeof body.password === 'string' ? body.password : ''
    const pwIssue = checkPasswordStrength(password)
    if (pwIssue) return badRequest(pwIssue)

    let interests: string[] = []
    if (body.interests !== undefined) {
      if (!Array.isArray(body.interests) || body.interests.length > 8) {
        return badRequest('Interests must be a list of at most 8 items')
      }
      interests = body.interests.filter((i): i is string => typeof i === 'string')
      if (interests.some((i) => !INTEREST_KEYS.has(i))) {
        return badRequest('One or more interests are not recognized')
      }
    }

    const displayNameRaw = typeof body.displayName === 'string' ? body.displayName : username
    const displayName = sanitizeText(displayNameRaw, 'displayName') || username
    if (displayName.length < 1) return badRequest('Display name is required')

    const [existingUsername, existingEmail] = await Promise.all([
      db.user.findUnique({ where: { username } }),
      db.user.findUnique({ where: { email } }),
    ])
    if (existingUsername) return badRequest('Username is already taken')
    if (existingEmail) return badRequest('Email is already registered')

    const userId = newId()
    const user = await db.user.create({
      data: {
        id: userId,
        email,
        username,
        displayName,
        passwordHash: hashPassword(password),
        avatarSeed: randomAvatarSeed(),
        interests: JSON.stringify([...new Set(interests)]),
        coins: 500,
      },
    })

    // founder badge + welcome notification + verification OTP + register XP
    await db.userBadge.create({ data: { id: newId(), userId, badgeKey: 'founder' } })
    await db.notification.create({
      data: {
        id: newId(),
        userId,
        kind: 'system',
        title: 'Welcome to Meev! 🐱',
        body: 'You joined during the founding era — the Founder badge is yours. Explore servers, post, and meet a stranger cat!',
        data: JSON.stringify({}),
      },
    })
    const code = newOtp()
    const expiresAt = new Date(Date.now() + 15 * 60_000)
    await db.emailToken.create({
      data: { id: newId(), userId, code, purpose: 'verify', expiresAt },
    })
    // v16: no register XP — levels come only from interaction hours

    const fresh = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const payload = await issueAuth(fresh, req)
    const res = Response.json({
      user: payload.user,
      accessToken: payload.accessToken,
      expiresIn: payload.expiresIn,
      // v13 security pass: OTP exposure only in SMTP demo mode (sandbox has
      // no mail transport); production must deliver codes out-of-band.
      ...(process.env.MEEV_SMTP_MODE === 'demo' && {
        devOtp: { code, purpose: 'verify', expiresAt: expiresAt.toISOString() },
      }),
    })
    setRefreshCookie(res, payload.rawRefresh)
    return res
  } catch (err) {
    return serverError(err)
  }
}
