// ============================================================
// MEEV v4 — Community Rules Engine (قوانين المجتمع)
//
// Every user-typed surface (DM / server messages, posts, comments,
// stories, notes) flows through here. Three rule families, each
// with a published, escalating punishment ladder:
//
//   1. SPAM      — floods, ads & invite links
//                  1st: warning · 2nd: 10-min mute · 3rd: 1-hour
//                  mute · 4th+: 24-hour suspension
//   2. INSULT    — hard profanity / السب والشتم
//                  1st: warning + message blocked · 2nd: 30-min
//                  mute · 3rd: 24-hour mute · 4th+: 3-day suspension
//   3. SELF-HARM — threatening self-harm / "fake suicide" cries
//                  (انتحار كذبي) — ALWAYS blocked: first we answer
//                  with support + resources (a real cry for help is
//                  never punished); after 3 abuses it is treated as
//                  manipulation → 24-hour suspension + support
//                  referral.
//
// Strikes persist on User.modStrikes (JSON map) and sanctions on
// User.mutedUntil / User.suspendedUntil. Every punishment notifies
// the user bilingually (kind: "moderation") and is audit-logged.
// ============================================================

import { db } from '@/lib/db'
import { newId } from './ids'
import { normalizeArabic, filterProfanity } from './profanity'
import { notifyUser } from './realtime'

export type RuleCategory = 'spam' | 'insult' | 'selfharm'

type StrikeMap = { spam?: number; insult?: number; selfharm?: number }

const MINUTE = 60_000
const HOUR = 3_600_000

// ------------------------- detection -------------------------

/** Self-harm / suicide threats (bilingual, normalized Arabic).
 *  Deliberately broad — we would rather over-detect and answer
 *  with kindness than miss a real cry for help. */
const SELF_HARM_PATTERNS: RegExp[] = [
  /انتحر/,
  /انتحار/,
  /اقتل نفسي/,
  /اقتلنى/,
  /اقتله نفسي/,
  /اذبح نفسي/,
  /انهي حياتي/,
  /اموت اليوم/,
  /اريد ان اموت/,
  /ابغى اموت/,
  /نفسي اموت/,
  /سوف انتحر/,
  /رح انتحر/,
  /ان حر/,
  /suicide/i,
  /suicidal/i,
  /kill\s*my\s*self/i,
  /end\s*my\s*life/i,
  /want\s*to\s*die/i,
  /wanna\s*die/i,
  /kms\b/i,
  /self[-\s]?harm/i,
]

/** Classic spam: invite / promo links and growth-begging. */
const SPAM_LINK_RE = /(t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite|whatsapp\.com\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/)/i
const SPAM_PROMO_RE = /(اشترك في|تابع قناتي|اشترك بقناة|join my (server|channel|group)|sub4sub|sub\s*for\s*sub|follow\s*for\s*follow|f4f\b)/i
/** Flood: the same character 20+ times in a row (e.g. aaaaaaaaaaaaaaaaaaaaaaaa). */
const FLOOD_RE = /(.)\1{19,}/

export function detectSelfHarm(text: string): boolean {
  const t = normalizeArabic(text.toLowerCase())
  return SELF_HARM_PATTERNS.some((re) => re.test(t))
}

export function detectSpam(text: string): boolean {
  const t = normalizeArabic(text.toLowerCase())
  return SPAM_LINK_RE.test(t) || SPAM_PROMO_RE.test(t) || FLOOD_RE.test(t)
}

/** Insult detection reuses the shared profanity list (hard tier only). */
export function detectInsult(text: string): boolean {
  return filterProfanity(text).hard
}

// ------------------------- sanctions -------------------------

export type Sanctions = {
  mutedUntil: Date | null
  suspendedUntil: Date | null
  strikes: StrikeMap
}

export function readSanctions(modStrikes: string): StrikeMap {
  try {
    const v = JSON.parse(modStrikes || '{}')
    return v && typeof v === 'object' ? (v as StrikeMap) : {}
  } catch {
    return {}
  }
}

/** Thrown when the user is muted or suspended. */
export class SanctionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Throws if suspended (blocks sign-in + every write surface). */
export function assertNotSuspended(u: { suspendedUntil: Date | null }): void {
  if (u.suspendedUntil && u.suspendedUntil.getTime() > Date.now()) {
    const left = Math.ceil((u.suspendedUntil.getTime() - Date.now()) / MINUTE)
    throw new SanctionError(
      403,
      `حسابك موقوف مؤقتاً لخرق قوانين المجتمع — يُفتح بعد ${left} دقيقة 🛡️ / Your account is temporarily suspended for breaking the community rules — it reopens in ${left} min 🛡️`
    )
  }
}

/** Throws if muted (blocks message sending only). */
export function assertNotMuted(u: { mutedUntil: Date | null }): void {
  if (u.mutedUntil && u.mutedUntil.getTime() > Date.now()) {
    const left = Math.ceil((u.mutedUntil.getTime() - Date.now()) / MINUTE)
    throw new SanctionError(
      403,
      `أنت مكتوم مؤقتاً بموجب قوانين المجتمع — يُرفع الكتم بعد ${left} دقيقة 🔇 / You are temporarily muted under the community rules — the mute lifts in ${left} min 🔇`
    )
  }
}

// ------------------------- punishment ladders -------------------------

type LadderStep = { until: number; labelAr: string; labelEn: string }

const SPAM_LADDER: LadderStep[] = [
  { until: 0, labelAr: 'تنبيه أول — توقّف عن السبام 🐾', labelEn: 'First warning — stop the spam 🐾' },
  { until: 10 * MINUTE, labelAr: 'كتم ١٠ دقائق بسبب السبام 🔇', labelEn: '10-minute mute for spam 🔇' },
  { until: 1 * HOUR, labelAr: 'كتم ساعة بسبب السبام المتكرر 🔇', labelEn: '1-hour mute for repeated spam 🔇' },
  { until: 24 * HOUR, labelAr: 'إيقاف ٢٤ ساعة بسبب السبام المستمر 🛡️', labelEn: '24-hour suspension for continued spam 🛡️' },
]

const INSULT_LADDER: LadderStep[] = [
  { until: 0, labelAr: 'تنبيه — احترم أعضاء ميف، السب ممنوع 🙈', labelEn: 'Warning — respect Meev members, insults are banned 🙈' },
  { until: 30 * MINUTE, labelAr: 'كتم ٣٠ دقيقة بسبب الإساءة 🔇', labelEn: '30-minute mute for insults 🔇' },
  { until: 24 * HOUR, labelAr: 'كتم ٢٤ ساعة بسبب الإساءة المتكررة 🔇', labelEn: '24-hour mute for repeated insults 🔇' },
  { until: 72 * HOUR, labelAr: 'إيقاف ٣ أيام — الإساءة لن تمرّ 🛡️', labelEn: '3-day suspension — abuse will not be tolerated 🛡️' },
]

function punish(
  category: 'spam' | 'insult',
  strikes: number
): { until: Date | null; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string } {
  const ladder = category === 'spam' ? SPAM_LADDER : INSULT_LADDER
  // strike #1 = ladder[0] (warning), #2 = 10-min/30-min mute, etc.
  const step = ladder[Math.min(Math.max(1, strikes) - 1, ladder.length - 1)]
  return {
    until: step.until > 0 ? new Date(Date.now() + step.until) : null,
    titleAr: category === 'spam' ? 'قاعدة السبام ⚠️' : 'قاعدة الاحترام ⚠️',
    titleEn: category === 'spam' ? 'Spam rule ⚠️' : 'Respect rule ⚠️',
    bodyAr: step.labelAr,
    bodyEn: step.labelEn,
  }
}

async function strikeUser(
  userId: string,
  category: RuleCategory,
  current: StrikeMap
): Promise<{ strikes: number; until: Date | null; notice: ReturnType<typeof punish> | null }> {
  const strikes = (current[category] ?? 0) + 1
  const data: Record<string, unknown> = { modStrikes: JSON.stringify({ ...current, [category]: strikes }) }

  if (category === 'spam' || category === 'insult') {
    const p = punish(category, strikes)
    if (p.until) {
      // rungs 1-3 mute; the top rung (4th strike+) suspends instead
      if (strikes >= 4) data.suspendedUntil = p.until
      else data.mutedUntil = p.until
    }
    await db.user.update({ where: { id: userId }, data }).catch(() => null)
    return { strikes, until: p.until, notice: p }
  }

  // self-harm: 3 abuses (after 2 supportive answers) → 24h suspension + referral
  if (strikes >= 3) {
    const until = new Date(Date.now() + 24 * HOUR)
    await db.user
      .update({ where: { id: userId }, data: { ...data, suspendedUntil: until } })
      .catch(() => null)
    return {
      strikes,
      until,
      notice: {
        until,
        titleAr: 'إحالة أمان 🛡️',
        titleEn: 'Safety referral 🛡️',
        bodyAr: 'تم إيقاف حسابك ٢٤ ساعة بعد تكرار تهديدات إيذاء النفس — فريق الدعم سيتواصل معك، ونحن هنا من أجلك.',
        bodyEn: 'Your account is suspended for 24h after repeated self-harm threats — the support team will reach out, and we are here for you.',
      },
    }
  }

  await db.user.update({ where: { id: userId }, data }).catch(() => null)
  return { strikes, until: null, notice: null }
}

// ------------------------- public API -------------------------

export type RuleVerdict = {
  blocked: boolean
  category?: RuleCategory
  message?: string
}

const SUPPORTIVE_AR =
  'رسالتك لم تُرسل لأنها تحتوي تهديداً بإيذاء النفس. حياتك غالية وأنت لست وحدك — تحدّث مع شخص تثق به أو اتصل بخط الدعم النفسي في بلدك فوراً 💜 إذا كنت تمر بأزمة حقيقية، ميف معك ويدك على قلوبنا.'
const SUPPORTIVE_EN =
  'Your message was not sent because it mentions self-harm. Your life matters and you are not alone — please reach out to someone you trust or a crisis line in your country right now 💜 If you are going through a real crisis, Meev cares about you.'

/**
 * Enforce the community rules on a piece of user-typed text.
 * Order of precedence: self-harm > insult > spam.
 * Applies strikes/punishments + notifications, then returns the
 * verdict (blocked messages never reach the DB).
 */
export async function enforceTextRules(userId: string, rawText: string): Promise<RuleVerdict> {
  const text = rawText ?? ''
  if (!text.trim()) return { blocked: false }

  // ---- 1. self-harm (always blocked, answered with support) ----
  if (detectSelfHarm(text)) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { modStrikes: true } })
    const current = readSanctions(user?.modStrikes || '{}')
    const { strikes } = await strikeUser(userId, 'selfharm', current)
    await notifyUser(
      userId,
      'moderation',
      'نحن نهتم بك 💜 / We care about you 💜',
      `${SUPPORTIVE_AR}${strikes >= 3 ? '' : '\n\n(تكرار هذا النوع من الرسائل يُعد انتحالاً عاطفياً ويؤدي للإيقاف / Repeating this kind of message is treated as emotional manipulation and leads to suspension)'}`,
      { rule: 'selfharm', strikes }
    ).catch(() => null)
    await db.auditLog
      .create({
        data: { id: newId(), userId, action: 'rule_selfharm_blocked', meta: JSON.stringify({ strikes }) },
      })
      .catch(() => null)
    return {
      blocked: true,
      category: 'selfharm',
      message: 'لم تُرسل رسالتك — تحدثنا معك عبر الإشعارات 💜 / Message not sent — check your notifications 💜',
    }
  }

  // ---- 2. insult (hard profanity) ----
  if (detectInsult(text)) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { modStrikes: true } })
    const current = readSanctions(user?.modStrikes || '{}')
    const { strikes, notice } = await strikeUser(userId, 'insult', current)
    if (notice) {
      await notifyUser(userId, 'moderation', `${notice.titleAr} / ${notice.titleEn}`, `${notice.bodyAr} / ${notice.bodyEn}`, {
        rule: 'insult',
        strikes,
      }).catch(() => null)
    }
    await db.auditLog
      .create({ data: { id: newId(), userId, action: 'rule_insult_blocked', meta: JSON.stringify({ strikes }) } })
      .catch(() => null)
    return {
      blocked: true,
      category: 'insult',
      message: 'هذه الرسالة غير مقبولة — السب ممنوع في ميف 🙈 / This message is not acceptable — insults are banned on Meev 🙈',
    }
  }

  // ---- 3. spam ----
  if (detectSpam(text)) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { modStrikes: true } })
    const current = readSanctions(user?.modStrikes || '{}')
    const { strikes, notice } = await strikeUser(userId, 'spam', current)
    if (notice) {
      await notifyUser(userId, 'moderation', `${notice.titleAr} / ${notice.titleEn}`, `${notice.bodyAr} / ${notice.bodyEn}`, {
        rule: 'spam',
        strikes,
      }).catch(() => null)
    }
    await db.auditLog
      .create({ data: { id: newId(), userId, action: 'rule_spam_blocked', meta: JSON.stringify({ strikes }) } })
      .catch(() => null)
    return {
      blocked: true,
      category: 'spam',
      message: 'تمهّل! السبام والدعايا ممنوعان في ميف 🐾 / Easy! Spam and ads are not allowed on Meev 🐾',
    }
  }

  return { blocked: false }
}

// ------------------------- published rules (settings UI) -------------------------

export const COMMUNITY_RULES: {
  key: RuleCategory
  emoji: string
  titleAr: string
  titleEn: string
  descAr: string
  descEn: string
  ladderAr: string[]
  ladderEn: string[]
}[] = [
  {
    key: 'spam',
    emoji: '🚫',
    titleAr: 'السبام والدعايا',
    titleEn: 'Spam & advertising',
    descAr: 'التكرار السريع، الروابط الدعائية، ودعوات القنوات الخارجية.',
    descEn: 'Rapid repeats, promo links and invites to outside channels.',
    ladderAr: ['تنبيه', 'كتم ١٠ دقائق', 'كتم ساعة', 'إيقاف ٢٤ ساعة'],
    ladderEn: ['Warning', '10-min mute', '1-hour mute', '24-hour suspension'],
  },
  {
    key: 'insult',
    emoji: '🙈',
    titleAr: 'السب والإساءة',
    titleEn: 'Insults & abuse',
    descAr: 'أي كلام بذيء أو مهين للأعضاء — يُحجب فوراً وبشكل تلقائي.',
    descEn: 'Any foul or abusive language — blocked automatically.',
    ladderAr: ['تنبيه + حجب الرسالة', 'كتم ٣٠ دقيقة', 'كتم ٢٤ ساعة', 'إيقاف ٣ أيام'],
    ladderEn: ['Warning + message blocked', '30-min mute', '24-hour mute', '3-day suspension'],
  },
  {
    key: 'selfharm',
    emoji: '💜',
    titleAr: 'تهديد إيذاء النفس',
    titleEn: 'Self-harm threats',
    descAr: 'نأخذ الأمر بجدية كاملة: الرسالة تُحجب ويصلك دعم فوري. التكرار كأسلوب ابتزاز عاطفي يؤدي للإيقاف.',
    descEn: 'Taken extremely seriously: the message is blocked and you get immediate support. Repeating it as emotional blackmail leads to suspension.',
    ladderAr: ['حجب + رسالة دعم', 'حجب + دعم', 'إيقاف ٢٤ ساعة + إحالة للدعم'],
    ladderEn: ['Blocked + support message', 'Blocked + support', '24-hour suspension + support referral'],
  },
]
