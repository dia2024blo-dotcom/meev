import { db } from '@/lib/db'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText, pickAllowed } from '@/lib/meev/sanitize'
import { filterProfanity, containsProfanity } from '@/lib/meev/profanity'
import { selfUser } from '@/lib/meev/dto'
import { levelFromXp } from '@/lib/meev/xp'
import { broadcast } from '@/lib/meev/realtime'
import { INTERESTS, NAME_COLORS, PRESENCE } from '@/lib/meev/constants'
import { verifyPassword, clearRefreshCookie } from '@/lib/meev/auth'

// v5 change locks: display name once per 30 days, interests once per 90 days
const NAME_LOCK_MS = 30 * 86400_000
const INTERESTS_LOCK_MS = 90 * 86400_000

function lockError(field: string, until: Date, lockMs: number): string {
  const days = Math.max(1, Math.ceil((until.getTime() + lockMs - Date.now()) / 86400_000))
  return field === 'name'
    ? `الاسم يُغيّر مرة واحدة كل شهر — بقيت لك ${days} يوم / The name can be changed once a month — ${days} day(s) left`
    : `الاهتمامات تُغيّر مرة واحدة كل ٣ أشهر — بقيت لك ${days} يوم / Interests can be changed once every 3 months — ${days} day(s) left`
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INTEREST_KEYS = new Set(INTERESTS.map((i) => i.key))
const PRESENCE_KEYS = new Set(Object.keys(PRESENCE))
const PRIVACY_FIELDS = new Set(['location', 'interests', 'presence'])
const PRIVACY_RULES = new Set(['everyone', 'friends', 'nobody'])

// v3 anti-forgery: shop cosmetic slots the profile PATCH may set. Values must
// be '' (clear) or an OWNED item key of the matching type (UserItem row) —
// without this check a raw API call could equip items never purchased.
const COSMETIC_SLOTS: Record<string, { column: string; prefix: string; type: string }> = {
  nameGradient: { column: 'nameGradient', prefix: 'ng-', type: 'name_gradient' },
  nameFx: { column: 'nameFx', prefix: 'nf-', type: 'name_effect' },
  frameKey: { column: 'frameKey', prefix: 'fr-', type: 'frame' },
  badgeShop: { column: 'badgeShop', prefix: 'bd-', type: 'badge' },
  avatarAcc: { column: 'avatarAcc', prefix: 'ac-', type: 'accessory' },
  coverKey: { column: 'coverKey', prefix: 'cv-', type: 'cover' },
  profileEffect: { column: 'profileEffect', prefix: 'pe-', type: 'profile_effect' },
}

/** Best-effort sync of UserItem.equipped flags inside an item's type
 *  (mirrors /api/shop/equip) so the wardrobe stays consistent. */
async function syncEquippedFlags(userId: string, type: string, equippedKey: string | null) {
  try {
    const typeRows = await db.shopCatalog.findMany({ where: { type }, select: { key: true } })
    await db.userItem.updateMany({
      where: { userId, itemKey: { in: typeRows.map((t) => t.key) } },
      data: { equipped: false },
    })
    if (equippedKey) {
      await db.userItem.updateMany({ where: { userId, itemKey: equippedKey }, data: { equipped: true } })
    }
  } catch {
    // flag sync is cosmetic bookkeeping — never fail the request
  }
}

type UpdateBody = {
  displayName?: unknown
  bio?: unknown
  city?: unknown
  interests?: unknown
  nameColor?: unknown
  presence?: unknown
  privacy?: unknown
  avatarPhoto?: unknown
  lang?: unknown
  note?: unknown
  customStatus?: unknown
  nameGradient?: unknown
  nameFx?: unknown
  frameKey?: unknown
  badgeShop?: unknown
  avatarAcc?: unknown
  coverKey?: unknown
  profileEffect?: unknown
  coverPhoto?: unknown
}

export async function PATCH(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const raw = (await readJson(req)) as UpdateBody
    const body = pickAllowed(raw, [
      'displayName',
      'bio',
      'city',
      'interests',
      'nameColor',
      'presence',
      'privacy',
      'avatarPhoto',
      'lang',
      'note',
      'customStatus',
      'nameGradient',
      'nameFx',
      'frameKey',
      'badgeShop',
      'avatarAcc',
      'coverKey',
      'profileEffect',
      'coverPhoto',
    ])

    const data: Record<string, unknown> = {}
    // { type, key } pairs to resync UserItem.equipped flags after the update
    const slotSyncs: { type: string; key: string | null }[] = []

    if (body.displayName !== undefined) {
      const displayName = sanitizeText(body.displayName, 'displayName')
      if (displayName.length < 1 || displayName.length > 32) {
        return badRequest('Display name must be 1-32 characters')
      }
      // identifiers must be profanity-free at ANY level (soft or hard)
      if (containsProfanity(displayName)) {
        return badRequest('يرجى اختيار اسم لائق 🙈 / Please pick a friendly name')
      }
      // v5: name change lock — once per 30 days (unchanged text = free pass)
      if (displayName !== g.user.displayName) {
        if (g.user.nameChangedAt && Date.now() - g.user.nameChangedAt.getTime() < NAME_LOCK_MS) {
          return Response.json(
            { error: lockError('name', g.user.nameChangedAt, NAME_LOCK_MS), field: 'name' },
            { status: 400 },
          )
        }
        data.displayName = displayName
        data.nameChangedAt = new Date()
      }
    }
    if (body.bio !== undefined) {
      // bio: soft profanity is masked with 🙈, hard profanity is rejected
      const bio = filterProfanity(sanitizeText(body.bio, 'bio'))
      if (bio.hard) {
        return badRequest('نعتذر، النبذة تحتوي كلمات لا نقبلها 🙈 / This bio contains words we cannot accept 🙈')
      }
      data.bio = bio.text
    }
    if (body.city !== undefined) {
      const cityRaw = typeof body.city === 'string' ? sanitizeText(body.city, 'city', 60) : ''
      // city: same policy as bio — mask soft, reject hard
      const city = filterProfanity(cityRaw)
      if (city.hard) {
        return badRequest('نعتذر، اسم المدينة يحتوي كلمات لا نقبلها 🙈 / That city name contains words we cannot accept 🙈')
      }
      data.city = city.text || null
    }
    if (body.interests !== undefined) {
      if (!Array.isArray(body.interests) || body.interests.length > 8) {
        return badRequest('Interests must be a list of at most 8 items')
      }
      const interests = body.interests.filter((i): i is string => typeof i === 'string')
      if (interests.some((i) => !INTEREST_KEYS.has(i))) return badRequest('One or more interests are not recognized')
      const next = JSON.stringify([...new Set(interests)])
      // v5: interests change lock — once per 90 days (same set = free pass)
      if (next !== g.user.interests) {
        if (
          g.user.interestsChangedAt &&
          Date.now() - g.user.interestsChangedAt.getTime() < INTERESTS_LOCK_MS
        ) {
          return Response.json(
            { error: lockError('interests', g.user.interestsChangedAt, INTERESTS_LOCK_MS), field: 'interests' },
            { status: 400 },
          )
        }
        data.interests = next
        data.interestsChangedAt = new Date()
      }
    }
    if (body.nameColor !== undefined) {
      const color = typeof body.nameColor === 'string' ? body.nameColor.trim() : ''
      if (levelFromXp(g.user.xp) < 1) return badRequest('Name colors unlock at level 1')
      if (color === '' || NAME_COLORS.includes(color)) {
        // free palette ('' = default / one of the unlocked hex colors)
        data.nameColor = color
        slotSyncs.push({ type: 'name_color', key: null })
      } else if (color.startsWith('nc-')) {
        // premium shop name color — must be OWNED (anti-forgery)
        const owned = await db.userItem.findUnique({
          where: { userId_itemKey: { userId: g.user.id, itemKey: color } },
        })
        if (!owned) return badRequest('That name color is not available')
        data.nameColor = color
        slotSyncs.push({ type: 'name_color', key: color })
      } else {
        return badRequest('That name color is not available')
      }
    }
    // v3 shop cosmetic slots (nameGradient/frameKey/badgeShop/avatarAcc/
    // coverKey/profileEffect): '' clears, otherwise the key must be OWNED
    for (const [field, slot] of Object.entries(COSMETIC_SLOTS)) {
      const value = (body as Record<string, unknown>)[field]
      if (value === undefined) continue
      if (value === '' || value === null) {
        data[slot.column] = ''
        slotSyncs.push({ type: slot.type, key: null })
        continue
      }
      if (typeof value !== 'string' || !value.startsWith(slot.prefix)) {
        return badRequest('Invalid cosmetic value')
      }
      const owned = await db.userItem.findUnique({
        where: { userId_itemKey: { userId: g.user.id, itemKey: value } },
      })
      if (!owned) {
        return badRequest('You do not own this item — visit the shop first! 🐾 / هذا العنصر ليس من مقتنياتك — زر المتجر أولاً! 🐾')
      }
      data[slot.column] = value
      slotSyncs.push({ type: slot.type, key: value })
    }
    if (body.presence !== undefined) {
      const presence = typeof body.presence === 'string' ? body.presence : ''
      if (!PRESENCE_KEYS.has(presence)) return badRequest('Invalid presence status')
      data.presence = presence
    }
    // v5: Discord-style custom status (≤60 chars, null clears)
    if (body.customStatus !== undefined) {
      if (body.customStatus === null || body.customStatus === '') {
        data.customStatus = null
      } else {
        const csRaw = sanitizeText(body.customStatus, 'note', 60)
        const cs = filterProfanity(csRaw)
        if (cs.hard) {
          return badRequest('نعتذر، الحالة تحتوي كلمات لا نقبلها 🙈 / This status contains words we cannot accept 🙈')
        }
        data.customStatus = cs.text
      }
    }
    if (body.privacy !== undefined) {
      if (typeof body.privacy !== 'object' || body.privacy === null || Array.isArray(body.privacy)) {
        return badRequest('privacy must be an object')
      }
      const current = JSON.parse(g.user.privacy || '{}') as Record<string, string>
      const next = { ...current }
      for (const [k, v] of Object.entries(body.privacy)) {
        if (!PRIVACY_FIELDS.has(k)) continue
        if (typeof v !== 'string' || !PRIVACY_RULES.has(v)) return badRequest(`Invalid privacy rule for ${k}`)
        next[k] = v
      }
      data.privacy = JSON.stringify(next)
    }

    if (body.avatarPhoto !== undefined) {
      if (body.avatarPhoto === null || body.avatarPhoto === '') {
        data.avatarPhoto = null // back to the MeevCat
      } else if (typeof body.avatarPhoto === 'string') {
        // only server-uploaded paths are accepted (no external URLs)
        const url = body.avatarPhoto.split('?')[0]
        if (!/^\/uploads\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png)$/.test(url)) {
          return badRequest('Invalid avatar image')
        }
        data.avatarPhoto = url
      }
    }
    // v11: LEGEND cover photo — the level-999 unlock. Only Legends (level
    // ≥ 999) may upload a custom cover image; everyone else gets the
    // bilingual gate. '' / null reverts to the equipped art cover.
    if (body.coverPhoto !== undefined) {
      const isLegend = levelFromXp(g.user.xp) >= 999
      if (body.coverPhoto === null || body.coverPhoto === '') {
        data.coverPhoto = null
      } else if (typeof body.coverPhoto === 'string') {
        if (!isLegend) {
          return Response.json(
            { error: 'صورة الغلاف الخاصة تُفتح عند المستوى ٩٩٩ ⚡ / The custom cover unlocks at level 999 ⚡' },
            { status: 403 },
          )
        }
        const url = body.coverPhoto.split('?')[0]
        if (!/^\/uploads\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png)$/.test(url)) {
          return badRequest('Invalid cover image')
        }
        data.coverPhoto = url
      }
    }
    if (body.lang !== undefined) {
      const l = typeof body.lang === 'string' ? body.lang : ''
      data.lang = ['en', 'fr', 'es', 'tr', 'de'].includes(l) ? l : 'ar'
    }
    // v4: Instagram-style note — a short thought that floats above the
    // profile avatar in the DM list (null/'' clears it)
    if (body.note !== undefined) {
      if (body.note === null || body.note === '') {
        data.note = null
      } else {
        const noteRaw = sanitizeText(body.note, 'note', 60)
        const note = filterProfanity(noteRaw)
        if (note.hard) {
          return badRequest('نعتذر، الملاحظة تحتوي كلمات لا نقبلها 🙈 / This note contains words we cannot accept 🙈')
        }
        data.note = note.text
      }
    }
    // empty PATCH body → no-op (Prisma rejects empty `data`)
    const updated = Object.keys(data).length > 0
      ? await db.user.update({ where: { id: g.user.id }, data })
      : g.user
    await db.user.update({ where: { id: g.user.id }, data: { lastActiveAt: new Date() } }).catch(() => null)

    // keep UserItem.equipped flags consistent with the freshly-set slots
    for (const sync of slotSyncs) {
      await syncEquippedFlags(g.user.id, sync.type, sync.key)
    }

    // broadcast presence change to everyone
    if (typeof data.presence === 'string' && data.presence !== g.user.presence) {
      await broadcast('global', 'presence:update', { userId: g.user.id, presence: data.presence })
    }

    return Response.json({ user: await selfUser(updated) })
  } catch (err) {
    return serverError(err)
  }
}

// ---------------- v10: self-service account deletion ----------------
// The admin console's `delete` command points users to "account deletion in
// settings" — this is that feature (the forgotten idea from the final QA
// sweep). Hard delete, cascading every post/message/gift via the schema's
// onDelete: Cascade — but gated HARD: password re-verification + typing the
// username exactly, owner accounts excluded (same rule as the console).
export async function DELETE(req: Request) {
  try {
    const g = await guard(req, 6, 60_000) // strict 6 tries/min on deletion
    if (g.response) return g.response
    const user = g.user

    if (user.role === 'owner') {
      return badRequest('حساب المالك لا يُحذف ذاتياً — نقل الملكية أولاً / The owner account cannot self-delete — transfer ownership first')
    }

    const body = (await readJson(req).catch(() => null)) as { password?: unknown; confirm?: unknown } | null
    const password = typeof body?.password === 'string' ? body.password : ''
    const confirm = typeof body?.confirm === 'string' ? body.confirm.trim().toLowerCase() : ''

    if (!verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { error: 'كلمة المرور غير صحيحة / Incorrect password' },
        { status: 401 }
      )
    }
    if (confirm !== user.username.toLowerCase()) {
      return badRequest('اكتب اسم المستخدم حرفياً للتأكيد / Type your username exactly to confirm')
    }

    // cascade wipe: sessions, refresh tokens, posts, stories, DMs, gifts,
    // follows, blocks, reports, notifications, items — everything
    const uname = user.username
    await db.user.delete({ where: { id: user.id } })

    const res = Response.json({ ok: true, deleted: uname })
    clearRefreshCookie(res)
    return res
  } catch (err) {
    return serverError(err)
  }
}
