// ============================================================
// MEEV v20 — Staff & admin command engine ("MeevCMD")
//
// A terminal-style command surface for the staff ladder:
//   user (0) < support (1) < moderator (2) < admin (3)
//   < superadmin (4) < owner (5)
//
// v20 permission doctrine (user spec — "قوة محدودة عمداً"):
//   · support   : tickets only + whois to help people
//   · moderator : support + mute/unmute/strikes/clear
//   · admin     : moderator's full set — NO verify, NO rank,
//                 NO badge, NO coins, NO ban (limited by design)
//   · superadmin: admin + ban/unban/verify/unverify/coins
//   · owner     : everything + role + delete + audit trail
//
// Every staff action lands in AuditLog (with the staff name);
// the owner watches it all via `audit` + the console side panel.
// ============================================================

import type { User, SupportTicket } from '@prisma/client'
import { db } from '@/lib/db'
import { newId } from './ids'
import { notifyUser } from './realtime'
import { sanitizeText } from './sanitize'
import { filterProfanity } from './profanity'
import { SUPPORT_CATEGORIES } from './constants'
import { levelProgress } from './xp'
import { broadcast } from './realtime'

export type StaffRole = 'user' | 'support' | 'moderator' | 'admin' | 'superadmin' | 'owner'

// v16: superadmin joins the ladder (user's spec: owner / admin / superadmin)
// — above admin, below owner.
export const ROLE_RANK: Record<string, number> = {
  user: 0,
  support: 1,
  moderator: 2,
  admin: 3,
  superadmin: 4,
  owner: 5,
}

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0
}

export const STAFF_ROLES: StaffRole[] = ['support', 'moderator', 'admin', 'superadmin', 'owner']

// ------------------------- permissions -------------------------

const PERMS: Record<string, number> = {
  help: 0,
  // ── support (1): ticket desk + helping people — nothing else
  tickets: 1,
  ticket: 1,
  reply: 1,
  whois: 1,
  // ── moderator (2): enforcement — mute & strike records
  strikes: 2,
  clear: 2,
  mute: 2,
  unmute: 2,
  // ── admin (3): inherits moderator's set ONLY (tickets + mute +
  //    simple commands). Verify / ranks / badges / coins / ban are
  //    deliberately OUT of admin's reach.
  // ── superadmin (4): serious powers
  ban: 4,
  unban: 4,
  verify: 4,
  unverify: 4,
  coins: 4,
  // ── owner (5): exclusive
  role: 5,
  delete: 5,
  audit: 5,
}

/** Reverse map: rank number → role name (for permission hints). */
const ROLE_BY_RANK: Record<number, string> = {
  0: 'user',
  1: 'support',
  2: 'moderator',
  3: 'admin',
  4: 'superadmin',
  5: 'owner',
}

export function canRun(role: string, command: string): boolean {
  const rank = roleRank(role)
  const needed = PERMS[command] ?? 99
  return rank >= needed
}

/** Superadmins may ban for at most 30 days — longer/permanent bans need the owner. */
const MOD_MAX_BAN_MS = 30 * 86400_000

// ------------------------- duration parsing -------------------------

export function parseDuration(s: string): number | null {
  if (!s) return null
  if (/^permanent|perma|forever$/i.test(s)) return 100 * 365 * 86400_000 // ~100 years
  const m = s.match(/^(\d+)\s*(m|min|mins|h|hr|hrs|d|day|days|w|week|weeks)$/i)
  if (!m) return null
  const n = Number(m[1])
  if (n <= 0) return null
  const unit = m[2].toLowerCase()
  if (unit.startsWith('m')) return n * 60_000
  if (unit.startsWith('h')) return n * 3600_000
  if (unit.startsWith('d')) return n * 86400_000
  return n * 7 * 86400_000
}

export function formatDuration(ms: number): string {
  if (ms >= 100 * 365 * 86400_000) return 'permanent'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

// ------------------------- helpers -------------------------

async function audit(userId: string | null, action: string, meta: Record<string, unknown>) {
  await db.auditLog
    .create({ data: { id: newId(), userId, action, meta: JSON.stringify(meta) } })
    .catch(() => null)
}

async function findTarget(handle: string): Promise<User | null> {
  const clean = handle.replace(/^@/, '').trim().toLowerCase()
  if (!clean) return null
  return (
    (await db.user.findUnique({ where: { username: clean } })) ||
    (await db.user.findFirst({ where: { email: clean } })) ||
    null
  )
}

const nameOf = (u: User) => `@${u.username} (${u.displayName})`

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

// ------------------------- v19: support desk helpers -------------------------

function fmtAge(d: Date | null): string {
  if (!d) return '—'
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${Math.max(s, 1)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const CAT_AR: Record<string, string> = Object.fromEntries(
  SUPPORT_CATEGORIES.map((c) => [c.key, c.labelAr]),
)

/** Resolve a ticket by full id or by its short #suffix (as shown in `tickets`). */
async function resolveTicket(ref: string): Promise<{ ticket: SupportTicket | null; ambiguous: boolean }> {
  const q = ref.replace(/^#/, '').trim()
  if (!q) return { ticket: null, ambiguous: false }
  if (q.length >= 12) {
    const t = await db.supportTicket.findUnique({ where: { id: q } })
    return { ticket: t, ambiguous: false }
  }
  if (q.length < 3) return { ticket: null, ambiguous: false }
  const cands = await db.supportTicket.findMany({ where: { id: { endsWith: q } } })
  if (cands.length === 1) return { ticket: cands[0], ambiguous: false }
  if (cands.length > 1) return { ticket: null, ambiguous: true }
  return { ticket: null, ambiguous: false }
}

/** Wrap a free-text field into terminal-friendly lines (message / reply bodies). */
function wrapText(text: string, width = 88, maxLines = 40): string[] {
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw
    while (line.length > width) {
      lines.push(line.slice(0, width))
      line = line.slice(width)
      if (lines.length >= maxLines) return [...lines, '…']
    }
    lines.push(line)
    if (lines.length >= maxLines) return [...lines, '…']
  }
  return lines
}

// ------------------------- command engine -------------------------

export type CmdResult = {
  ok: boolean
  lines: string[]
}

const HELP_LINES = [
  'MeevCMD v20 — مصفوفة الأوامر حسب الرتبة / commands by role',
  '══════════════════════════════════════════════════',
  '👤 الجميع / everyone',
  '   help                        — هذه القائمة',
  '',
  '🎫 support (الدعم) — يرد على التذاكر ويساعد الناس فقط',
  '   tickets [open]              — صندوق تذاكر الدعم (🆕 تنتظر رداً · ✅ تم الرد)',
  '   ticket <id>                 — قراءة التذكرة كاملة (من، التصنيف، الرسالة)',
  '   reply <id> <نص الرد>        — الرد البشري على التذكرة 💬 (يستبدل الرد الآلي)',
  '   whois @user                 — بيانات الحساب (لمساعدة المستخدمين)',
  '',
  '🔇 moderator (الإشراف) — كل أوامر support + الكتم والمخالفات',
  '   mute @user <30m|2h|7d> [سبب] — كتم',
  '   unmute @user                — فك الكتم',
  '   strikes @user               — سجل المخالفات',
  '   clear @user                 — مسح المخالفات',
  '',
  '🛡️ admin (الإدارة) — كل أوامر moderator (تذاكر + كتم + أوامر بسيطة)',
  '   ⚠️ قوة محدودة عمداً: لا توثيق · لا رتب · لا شارات · لا ذهب · لا حظر',
  '',
  '⚡ superadmin (الإدارة العليا) — كل أوامر admin + الصلاحيات الجدية',
  '   ban @user <مدة|permanent> [سبب] — حظر (بحد أقصى 30 يوم)',
  '   unban @user                 — فك الحظر',
  '   verify @user                — توثيق الحساب ✅',
  '   unverify @user              — إزالة التوثيق',
  '   coins @user +500|-100       — منح/خصم ذهب Meev 🪙',
  '',
  '👑 owner (المالك) — كل شيء + ما يلي حصراً',
  '   role @user <user|support|moderator|admin|superadmin> — تغيير الرتبة',
  '   delete @user confirm        — حذف حساب نهائياً',
  '   audit [صفحة] [@user]        — سجل تدقيق كل عمليات الفريق 📜',
  '══════════════════════════════════════════════════',
  'ℹ️ كل عملية يقوم بها الفريق تُسجل في سجل التدقيق باسم الموظف.',
]

// v20: readable audit-trail labels + one-line summaries, shared by the
// `audit` command (MeevCMD) and the console side panel (/api/admin/logs).
export const ACTION_LABELS: Record<string, string> = {
  ticket_reply: '💬 رد على تذكرة',
  admin_mute: '🔇 كتم',
  admin_unmute: '🔊 فك كتم',
  admin_ban: '🚫 حظر',
  admin_unban: '♻️ فك حظر',
  admin_verify: '✅ توثيق',
  admin_unverify: '❌ إزالة توثيق',
  admin_coins: '🪙 منح/خصم ذهب',
  admin_role: '🏷️ تغيير رتبة',
  admin_clear_strikes: '🧹 مسح مخالفات',
  admin_delete_user: '🗑️ حذف حساب',
}

/** Build a compact human summary of a staff audit entry from its meta. */
export function summarizeAudit(action: string, meta: Record<string, unknown>): string {
  const t = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '')
  switch (action) {
    case 'ticket_reply':
      return `التذكرة #${t('ticketId').slice(-6) || '؟'} → @${t('target')} · الرد: «${t('reply')}»`
    case 'admin_mute':
    case 'admin_ban':
      return `@${t('target')} · ${t('duration')}${t('reason') && t('reason') !== '—' ? ` · السبب: ${t('reason')}` : ''}`
    case 'admin_coins': {
      const d = Number(meta.delta ?? 0)
      return `@${t('target')} · ${d > 0 ? '+' : ''}${d} ذهب → الرصيد ${String(meta.balanceAfter ?? '؟')}`
    }
    case 'admin_role':
      return `@${t('target')} → الرتبة ${t('newRole')}`
    case 'admin_delete_user':
      return `حُذف @${t('target')} نهائياً مع كل بياناته`
    case 'admin_clear_strikes':
      return `مُحيت مخالفات @${t('target')}`
    default: {
      if (t('target')) return `@${t('target')}`
      const s = JSON.stringify(meta)
      return s === '{}' ? '' : s.slice(0, 80)
    }
  }
}

export async function runAdminCommand(actor: User, raw: string): Promise<CmdResult> {
  const input = raw.trim()
  if (!input) return { ok: false, lines: ['empty command — اكتب help'] }

  const parts = input.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)
  const lines: string[] = []
  const rank = roleRank(actor.role)

  if (cmd === 'help') {
    const mine = Object.entries(PERMS)
      .filter(([, need]) => rank >= need)
      .map(([k]) => k)
      .sort()
    return {
      ok: true,
      lines: [
        ...HELP_LINES,
        `رتبتك / your role: ${actor.role} (rank ${rank})`,
        `أوامرك المتاحة (${mine.length}): ${mine.join(' · ')}`,
      ],
    }
  }

  if (!canRun(actor.role, cmd)) {
    const needed = PERMS[cmd] ?? 99
    const ownerOnly = cmd === 'role' || cmd === 'delete' || cmd === 'audit'
    return {
      ok: false,
      lines: [
        `⛔ الأمر "${cmd}" غير متاح لرتبتك (${actor.role}).`,
        ownerOnly
          ? `🔒 "${cmd}" متاح للمالك (owner) حصراً.`
          : `الحد الأدنى لهذا الأمر: ${ROLE_BY_RANK[needed] ?? '؟'} — رتبتك الحالية: ${actor.role}.`,
        'اكتب help لعرض مصفوفة الأوامر حسب الرتبة.',
      ],
    }
  }

  // ---- commands that need a target (@user) ----
  // (the support-desk commands tickets/ticket/reply address TICKETS, not users)
  const TARGET_CMDS = new Set([
    'whois', 'mute', 'unmute', 'ban', 'unban', 'verify', 'unverify',
    'coins', 'strikes', 'clear', 'role', 'delete',
  ])
  const handle = args[0]
  if (!handle && TARGET_CMDS.has(cmd)) {
    return { ok: false, lines: [`⛔ حدد الحساب: ${cmd} @username`] }
  }
  const target = TARGET_CMDS.has(cmd) ? await findTarget(handle) : null

  switch (cmd) {
    // ================ v19: SUPPORT DESK ================

    case 'tickets': {
      const onlyOpen = (args[0] || '').toLowerCase() === 'open'
      const [list, openCount] = await Promise.all([
        db.supportTicket.findMany({
          where: onlyOpen ? { status: 'open' } : undefined,
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        db.supportTicket.count({ where: { status: 'open' } }),
      ])
      const ids = [...new Set(list.map((t) => t.userId))]
      const authors = ids.length
        ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
        : []
      const nameById = new Map(authors.map((a) => [a.id, `@${a.username}`]))
      lines.push(
        `📋 صندوق تذاكر الدعم / support desk — ${onlyOpen ? 'المفتوحة فقط 🆕' : 'الكل'} (${list.length})`,
        `   🆕 تنتظر رداً بشرياً: ${openCount} · ✅ تم الرد: ${await db.supportTicket.count() - openCount}`,
      )
      if (!list.length) {
        lines.push('   صندوق نظيف — لا تذاكر هنا ✨')
        return { ok: true, lines }
      }
      for (const t of list) {
        const icon = t.status === 'answered' ? '✅' : '🆕'
        lines.push(
          `   ${icon} #${t.id.slice(-6)} · ${nameById.get(t.userId) ?? 'مستخدم'} · «${t.subject.slice(0, 42)}» · ${CAT_AR[t.category] ?? t.category} · ${fmtAge(t.createdAt)}`,
        )
      }
      lines.push('   ────────────────────────────────────')
      lines.push('   للقراءة: ticket <id> · للرد: reply <id> <نص الرد>')
      return { ok: true, lines }
    }

    case 'ticket': {
      const { ticket, ambiguous } = await resolveTicket(args[0] || '')
      if (ambiguous) return { ok: false, lines: ['⛔ الرقم المختصر يطابق أكثر من تذكرة — استخدم الرقم الكامل.'] }
      if (!ticket) return { ok: false, lines: ['⛔ ما لقيت التذكرة — خذ الرقم من أمر tickets ثم أعد المحاولة.'] }
      const owner = await db.user.findUnique({
        where: { id: ticket.userId },
        select: { username: true, displayName: true },
      })
      lines.push(
        `🎫 تذكرة #${ticket.id.slice(-6)} — ${ticket.status === 'answered' ? '✅ تم الرد' : '🆕 تنتظر رداً بشرياً'}`,
        `   من / from   : @${owner?.username ?? 'مستخدم'} (${owner?.displayName ?? ''})`,
        `   التصنيف     : ${CAT_AR[ticket.category] ?? ticket.category}`,
        `   الموضوع     : «${ticket.subject}»`,
        `   أُرسلت      : ${fmtDate(ticket.createdAt)} (${fmtAge(ticket.createdAt)})`,
        '   ────────────────────────────────────',
        '   📝 الرسالة كاملة / full message:',
        ...wrapText(ticket.message).map((l) => `   │ ${l}`),
        '   ────────────────────────────────────',
      )
      if (ticket.reply) {
        const staff = ticket.repliedById
          ? await db.user.findUnique({ where: { id: ticket.repliedById }, select: { username: true } })
          : null
        lines.push(
          `   💬 رد الفريق @${staff?.username ?? 'meev'} · ${fmtDate(ticket.repliedAt)} (منذ ${fmtAge(ticket.repliedAt)}):`,
          ...wrapText(ticket.reply).map((l) => `   │ ${l}`),
        )
      } else {
        lines.push('   🤖 رد آلي فقط — التذكرة تنتظر رداً بشرياً من الفريق.')
        lines.push(`   → للرد الآن: reply ${ticket.id.slice(-6)} <نص الرد>`)
      }
      return { ok: true, lines }
    }

    case 'reply': {
      const m = input.match(/^reply\s+#?([^\s]+)\s+([\s\S]+)$/i)
      if (!m) {
        return { ok: false, lines: ['⛔ الصيغة: reply <id> <نص الرد> — مثال: reply 421304 تم حل المشكلة، جرّب الآن!'] }
      }
      const { ticket, ambiguous } = await resolveTicket(m[1])
      if (ambiguous) return { ok: false, lines: ['⛔ الرقم المختصر يطابق أكثر من تذكرة — استخدم الرقم الكامل.'] }
      if (!ticket) return { ok: false, lines: ['⛔ ما لقيت التذكرة — خذ الرقم من أمر tickets ثم أعد المحاولة.'] }
      // staff text passes the same cleanliness gates as user text
      const filtered = filterProfanity(sanitizeText(m[2], 'message', 2000))
      if (filtered.hard) return { ok: false, lines: ['⛔ نص الرد يحتوي كلمات لا نقبلها 🙈 / reply rejected by the word filter.'] }
      if (filtered.text.trim().length < 2) return { ok: false, lines: ['⛔ نص الرد قصير جداً — اكتب رداً حقيقياً.'] }
      const now = new Date()
      await db.supportTicket.update({
        where: { id: ticket.id },
        data: { reply: filtered.text, status: 'answered', repliedAt: now, repliedById: actor.id },
      })
      const owner = await db.user.findUnique({
        where: { id: ticket.userId },
        select: { username: true },
      })
      await audit(actor.id, 'ticket_reply', {
        ticketId: ticket.id,
        target: owner?.username ?? ticket.userId,
        staff: actor.username,
        reply: filtered.text.slice(0, 80),
      })
      // instant push to the user (notification row + realtime socket)
      await notifyUser(
        ticket.userId,
        'system',
        '💬 ردّ فريق الدعم على تذكرتك',
        `«${ticket.subject}» — ${filtered.text.slice(0, 140)}`,
        { ticketId: ticket.id },
      ).catch(() => null)
      return {
        ok: true,
        lines: [
          `✅ رُسل ردك إلى @${owner?.username ?? 'المستخدم'} على التذكرة #${ticket.id.slice(-6)}.`,
          '   💬 استُبدل الرد الآلي في «تذاكري»، ووصل إشعار فوري للمستخدم.',
          '   📜 سُجّل الرد في سجل التدقيق باسمك.',
        ],
      }
    }

    // ================ END support desk ================

    case 'whois': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const strikes = JSON.parse(target.modStrikes || '{}') as Record<string, number>
      const mutedLeft = target.mutedUntil && target.mutedUntil > new Date() ? target.mutedUntil.getTime() - Date.now() : 0
      const bannedLeft = target.bannedUntil && target.bannedUntil > new Date() ? target.bannedUntil.getTime() - Date.now() : 0
      lines.push(
        `👤 ${nameOf(target)}`,
        `   id: ${target.id}`,
        `   email: ${target.email}`,
        `   role: ${target.role} · verified: ${target.verifiedAt ? '✅' : '—'} · bot: ${target.isBot}`,
        `   level: ${levelProgress(target.xp).level} · xp: ${target.xp} · gold: ${target.coins}`,
        `   presence: ${target.presence} · joined: ${fmtDate(target.createdAt)}`,
        `   strikes: ${Object.keys(strikes).length ? JSON.stringify(strikes) : 'none'}`,
        mutedLeft > 0 ? `   🔇 muted for ${formatDuration(mutedLeft)}` : '   mute: —',
        bannedLeft > 0 ? `   🚫 BANNED for ${formatDuration(bannedLeft)}${target.bannedReason ? ` — ${target.bannedReason}` : ''}` : '   ban: —',
      )
      return { ok: true, lines }
    }

    case 'mute': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const dur = parseDuration(args[1] || '')
      if (!dur) return { ok: false, lines: ['⛔ مدة غير صحيحة — استخدم 30m / 2h / 7d'] }
      if (roleRank(target.role) >= rank && target.id !== actor.id) {
        return { ok: false, lines: ['⛔ ما تقدر تكتم أحد من فريق الإدارة.'] }
      }
      const reason = args.slice(2).join(' ') || '—'
      await db.user.update({
        where: { id: target.id },
        data: { mutedUntil: new Date(Date.now() + dur) },
      })
      await audit(actor.id, 'admin_mute', { target: target.username, duration: formatDuration(dur), reason })
      await notifyUser(
        target.id,
        'moderation',
        `🔇 تم كتمك لمدة ${formatDuration(dur)}`,
        reason !== '—' ? `السبب: ${reason}` : '',
      )
      return { ok: true, lines: [`✅ كُتم ${nameOf(target)} لمدة ${formatDuration(dur)}.`] }
    }

    case 'unmute': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      await db.user.update({ where: { id: target.id }, data: { mutedUntil: null } })
      await audit(actor.id, 'admin_unmute', { target: target.username })
      await notifyUser(target.id, 'moderation', '🔊 فُك عنك الكتم', 'يمكنك المراسلة من جديد.')
      return { ok: true, lines: [`✅ فُك الكتم عن ${nameOf(target)}.`] }
    }

    case 'ban': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const dur = parseDuration(args[1] || '')
      if (!dur) return { ok: false, lines: ['⛔ مدة غير صحيحة — استخدم 30m / 2h / 7d / permanent'] }
      if (target.id === actor.id) return { ok: false, lines: ['⛔ ما تقدر تحظر نفسك!'] }
      if (roleRank(target.role) >= rank) {
        return { ok: false, lines: ['⛔ ما تقدر تحظر أحد من نفس رتبتك أو أعلى.'] }
      }
      if (rank < 5 && dur > MOD_MAX_BAN_MS) {
        return { ok: false, lines: ['⛔ كحد أقصى لك: 30 يوم — الحظر الأطول/الدائم يحتاج رتبة owner.'] }
      }
      const reason = args.slice(2).join(' ') || '—'
      await db.user.update({
        where: { id: target.id },
        data: { bannedUntil: new Date(Date.now() + dur), bannedReason: reason },
      })
      // kill their sessions so the ban bites immediately
      await db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })
      await db.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } })
      await broadcast(`user:${target.id}`, 'socket:force-signout', { reason: 'banned' })
      await audit(actor.id, 'admin_ban', { target: target.username, duration: formatDuration(dur), reason })
      await notifyUser(
        target.id,
        'moderation',
        `🚫 تم حظرك ${dur >= 100 * 365 * 86400_000 ? 'نهائياً' : `حتى ${fmtDate(new Date(Date.now() + dur))}`}`,
        reason !== '—' ? `السبب: ${reason}` : '',
      )
      return {
        ok: true,
        lines: [
          `✅ حُظر ${nameOf(target)} ${dur >= 100 * 365 * 86400_000 ? 'نهائياً' : `لمدة ${formatDuration(dur)}`}.`,
          '   انهيت جلساته وسجّلت العملية في سجل التدقيق.',
        ],
      }
    }

    case 'unban': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      await db.user.update({ where: { id: target.id }, data: { bannedUntil: null, bannedReason: null } })
      await audit(actor.id, 'admin_unban', { target: target.username })
      await notifyUser(target.id, 'moderation', '🎉 فُك عنك الحظر', 'مرحباً بعودتك إلى Meev!')
      return { ok: true, lines: [`✅ فُك الحظر عن ${nameOf(target)}.`] }
    }

    case 'verify': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      if (target.verifiedAt) return { ok: false, lines: [`ℹ️ ${nameOf(target)} موثّق أصلاً.`] }
      await db.user.update({ where: { id: target.id }, data: { verifiedAt: new Date() } })
      await audit(actor.id, 'admin_verify', { target: target.username })
      await notifyUser(target.id, 'system', '✅ تم توثيق حسابك!', 'حسابك الآن يحمل شارة التوثيق الزرقاء.')
      return { ok: true, lines: [`✅ وُثّق ${nameOf(target)} — الشارة الزرقاء ظاهرة بجانب اسمه.`] }
    }

    case 'unverify': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      await db.user.update({ where: { id: target.id }, data: { verifiedAt: null } })
      await audit(actor.id, 'admin_unverify', { target: target.username })
      await notifyUser(target.id, 'system', 'أُزيل توثيق حسابك', 'لم يعد حسابك يحمل شارة التوثيق.')
      return { ok: true, lines: [`✅ أُزيل التوثيق عن ${nameOf(target)}.`] }
    }

    case 'coins': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const deltaStr = args[1] || ''
      const m = deltaStr.match(/^([+-])(\d+)$/)
      if (!m) return { ok: false, lines: ['⛔ استخدم الصيغة: coins @user +500 أو coins @user -100'] }
      const delta = Number(`${m[1]}${m[2]}`)
      if (target.coins + delta < 0) return { ok: false, lines: [`⛔ الرصيد سيصبح سالباً (${target.coins} ${delta < 0 ? delta : `+${delta}`}).`] }
      const after = await db.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: target.id }, data: { coins: { increment: delta } } })
        await tx.coinLog.create({
          data: {
            id: newId(),
            userId: target.id,
            delta,
            reason: 'admin_grant',
            balanceAfter: updated.coins,
            contextId: actor.username,
          },
        })
        return updated
      })
      await audit(actor.id, 'admin_coins', { target: target.username, delta, balanceAfter: after.coins })
      await notifyUser(
        target.id,
        'system',
        delta > 0 ? `🪙 استلمت ${delta} ذهب Meev!` : `خصم ${Math.abs(delta)} ذهب Meev من رصيدك`,
        `رصيدك الحالي: ${after.coins}`,
      )
      return { ok: true, lines: [`✅ ${delta > 0 ? 'أُضيف' : 'خُصم'} ${Math.abs(delta)} ذهب → رصيد ${nameOf(target)} الآن ${after.coins} 🪙`] }
    }

    case 'strikes': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const strikes = JSON.parse(target.modStrikes || '{}') as Record<string, number>
      lines.push(`📋 مخالفات ${nameOf(target)}:`)
      const entries = Object.entries(strikes).filter(([, v]) => v > 0)
      if (!entries.length) lines.push('   نظيف — لا مخالفات ✨')
      for (const [k, v] of entries) lines.push(`   ${k}: ${v}`)
      if (target.mutedUntil && target.mutedUntil > new Date()) {
        lines.push(`   🔇 كتم متبقٍ: ${formatDuration(target.mutedUntil.getTime() - Date.now())}`)
      }
      return { ok: true, lines }
    }

    case 'clear': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      await db.user.update({ where: { id: target.id }, data: { modStrikes: '{}', mutedUntil: null } })
      await audit(actor.id, 'admin_clear_strikes', { target: target.username })
      await notifyUser(target.id, 'moderation', '🧹 مُحيت مخالفاتك', 'صفحة جديدة — استمر بالسلوك الحسن!')
      return { ok: true, lines: [`✅ مُحيت مخالفات ${nameOf(target)}.`] }
    }

    case 'role': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      const newRole = (args[1] || '').toLowerCase()
      if (!['user', 'support', 'moderator', 'admin', 'superadmin'].includes(newRole)) {
        return { ok: false, lines: ['⛔ الرتب المتاحة: user | support | moderator | admin | superadmin (owner يُعيّن يدوياً).'] }
      }
      if (target.role === 'owner') return { ok: false, lines: ['⛔ لا يمكن تغيير رتبة المالك.'] }
      if (newRole === 'owner') return { ok: false, lines: ['⛔ تعيين owner يتم من قاعدة البيانات فقط (meev-cli: owner-setup).'] }
      // only the OWNER may mint/demote a superadmin
      if (newRole === 'superadmin' && actor.role !== 'owner') {
        return { ok: false, lines: ['⛔ تعيين superadmin متاح للمالك (owner) فقط.'] }
      }
      if (roleRank(newRole) >= rank) {
        return { ok: false, lines: ['⛔ ما تقدر ترفع أحد إلى رتبتك أو أعلى منها.'] }
      }
      await db.user.update({ where: { id: target.id }, data: { role: newRole } })
      await audit(actor.id, 'admin_role', { target: target.username, newRole })
      await notifyUser(target.id, 'system', `🏷️ رتبتك الجديدة: ${newRole}`, 'حُدّثت صلاحياتك في Meev.')
      return { ok: true, lines: [`✅ رتبة ${nameOf(target)} صارت ${newRole}.`] }
    }

    case 'delete': {
      if (!target) return { ok: false, lines: [`⛔ ما لقيت المستخدم ${handle}`] }
      if (target.id === actor.id) return { ok: false, lines: ['⛔ ما تقدر تحذف حسابك من هنا — استخدم حذف الحساب في الإعدادات.'] }
      if (target.role === 'owner') return { ok: false, lines: ['⛔ لا يمكن حذف حساب المالك.'] }
      // confirm flag: "delete @user confirm"
      if ((args[1] || '').toLowerCase() !== 'confirm') {
        return {
          ok: false,
          lines: [
            `⚠️ حذف ${nameOf(target)} نهائي وغير قابل للتراجع.`,
            `   كل منشوراته ورسائله وهداياه ستُمحى.`,
            `   للتأكيد اكتب: delete @${target.username} confirm`,
          ],
        }
      }
      const uname = target.username
      await db.user.delete({ where: { id: target.id } })
      await audit(actor.id, 'admin_delete_user', { target: uname })
      return { ok: true, lines: [`🗑️ حُذف حساب @${uname} نهائياً (مع كل بياناته).`] }
    }

    // ================ v20: OWNER AUDIT TRAIL ================

    case 'audit': {
      // usage: audit [page] [@staff] — the owner's all-seeing eye over
      // every staff action (coin grants, mutes, bans, ticket replies…).
      let page = 1
      let actorHandle = ''
      for (const a of args) {
        if (a.startsWith('@')) actorHandle = a.replace(/^@/, '').toLowerCase()
        else if (/^\d+$/.test(a)) page = Math.max(1, Number(a))
      }
      const staffUser = actorHandle ? await findTarget(actorHandle) : null
      if (actorHandle && !staffUser) {
        return { ok: false, lines: [`⛔ ما لقيت الموظف @${actorHandle}`] }
      }
      const where: { OR: { action: { startsWith: string } }[]; userId?: string } = {
        OR: [{ action: { startsWith: 'admin_' } }, { action: 'ticket_reply' }],
      }
      if (staffUser) where.userId = staffUser.id
      const PER_PAGE = 25
      const total = await db.auditLog.count({ where })
      const pages = Math.max(1, Math.ceil(total / PER_PAGE))
      if (page > pages) page = pages
      const rows = await db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      })
      const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))]
      const actors = ids.length
        ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
        : []
      const nameById = new Map(actors.map((a) => [a.id, a.username]))
      lines.push(
        `📜 سجل التدقيق / staff audit trail${staffUser ? ` — @${staffUser.username}` : ''}`,
        `   الصفحة ${page} من ${pages} · ${total} عملية مسجلة (25 لكل صفحة)`,
        '   ────────────────────────────────────',
      )
      if (!rows.length) {
        lines.push('   لا عمليات مسجلة بعد ✨')
        return { ok: true, lines }
      }
      for (const r of rows) {
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(r.meta || '{}') as Record<string, unknown>
        } catch {
          meta = {}
        }
        const who = r.userId && nameById.get(r.userId) ? `@${nameById.get(r.userId)}` : 'system'
        lines.push(`[${fmtDate(r.createdAt)}] ${who} — ${ACTION_LABELS[r.action] ?? r.action}`)
        const sum = summarizeAudit(r.action, meta)
        if (sum) lines.push(`   ${sum}`)
      }
      lines.push('   ────────────────────────────────────')
      lines.push('   → الصفحة التالية: audit ' + (page + 1) + ' · تصفية بموظف: audit @username')
      return { ok: true, lines }
    }

    default:
      return { ok: false, lines: [`⛔ أمر غير معروف: "${cmd}" — اكتب help لعرض الأوامر.`] }
  }
}
