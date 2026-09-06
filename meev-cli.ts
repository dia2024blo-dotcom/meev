#!/usr/bin/env bun
// ============================================================
// MEEV — MeevCMD v19 "Owner Terminal" (real command-line CLI)
//
// A real interactive terminal that lives in the site's files and
// manages the platform directly against the database + realtime
// service. REUSES the in-app admin engine (src/lib/meev/admin.ts)
// and the site's own libs (db, auth, xp, realtime) — one engine,
// two surfaces (in-app MeevCMD console + this real CMD).
//
// Usage:
//   bun meev-cli.ts                      → interactive REPL (banner, history ↑/↓)
//   bun meev-cli.ts "whois @mochi"       → one-shot command
//   bun meev-cli.ts whois @mochi         → one-shot (argv style)
//
// The actor is ALWAYS the OWNER (role='owner', seed: @othman /
// othmanxbaroum@gmail.com). CLI-only commands (owner, owner-setup,
// users, logs, sessions, passreset) are the DB-level manual path
// that the in-app engine deliberately blocks. Every mutation is
// audited (AuditLog action 'cli_*') and never crashes the REPL.
//
// Bun auto-loads .env (DATABASE_URL) and resolves tsconfig paths
// (@/* → ./src/*), so the site's modules import unchanged.
// ============================================================

import * as readline from 'node:readline/promises'
import { PrismaClient, type User } from '@prisma/client'

// ------------------------------------------------------------
// 1) QUIET PRISMA — must happen BEFORE '@/lib/db' is imported.
//    db.ts builds a dev client with log:['query'] (great for the
//    Next dev server, way too noisy for a terminal). db.ts reuses
//    a healthy cached global singleton — so we pre-seed it here
//    with a quiet client and every later import gets this one.
// ------------------------------------------------------------
const g = globalThis as unknown as { prisma?: PrismaClient }
if (!g.prisma) g.prisma = new PrismaClient({ log: ['warn', 'error'] })

// dynamic imports so the quiet client is in place first
const { db } = await import('@/lib/db')
const { runAdminCommand } = await import('@/lib/meev/admin')
const { hashPassword, checkPasswordStrength } = await import('@/lib/meev/auth')
const { levelProgress } = await import('@/lib/meev/xp')
const { notifyUser, broadcast } = await import('@/lib/meev/realtime')
const { newId } = await import('@/lib/meev/ids')

// ------------------------------------------------------------
// 2) ANSI — professional terminal look (auto-off when piped)
// ------------------------------------------------------------
const TTY = !!process.stdout.isTTY
const FORCED = !!process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0'
const COLOR = (TTY || FORCED) && !process.env.NO_COLOR
const A = (open: string) => (s: string) => (COLOR ? `\x1b[${open}m${s}\x1b[0m` : s)
const bold = A('1')
const dim = A('2')
const red = A('31')
const green = A('32')
const yellow = A('33')
const magenta = A('35')
const cyan = A('36')
const gold = (s: string) => (COLOR ? `\x1b[1;33m${s}\x1b[0m` : s) // bold yellow
const head = (s: string) => (COLOR ? `\x1b[1;36m${s}\x1b[0m` : s) // bold cyan

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const pad = (s: string, n: number): string => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length))
const padL = (s: string, n: number): string => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s)
const fmtTs = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ') // UTC
const clampInt = (raw: string | undefined, dflt: number, min: number, max: number): number => {
  const n = parseInt((raw || '').trim(), 10)
  if (Number.isNaN(n)) return dflt
  return Math.max(min, Math.min(max, n))
}

// never let an async blip kill the terminal
process.on('unhandledRejection', (e) => console.error(red(`⛔ خطأ غير متوقع / unexpected: ${msg(e)}`)))
process.on('uncaughtException', (e) => console.error(red(`⛔ خطأ غير متوقع / unexpected: ${msg(e)}`)))

// ------------------------------------------------------------
// 3) BOOT — resolve the OWNER (the CLI actor)
// ------------------------------------------------------------
let OWNER: User | null = null
try {
  OWNER = await db.user.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } })
} catch (e) {
  console.error(red(`⛔ ما قدرت أوصل قاعدة البيانات — database unreachable: ${msg(e)}`))
  console.error(red('   تأكد من DATABASE_URL في ملف .env ثم أعد تشغيل الطرفية.'))
  process.exit(1)
}
if (!OWNER) {
  console.error(red("⛔ ما لقيت حساب مالك (role='owner') في قاعدة البيانات."))
  console.error(red("   No owner account (role='owner') found in the database."))
  console.error(red('   أنشئ حساب المالك أولاً ثم شغّل الطرفية / create the owner first, then run MeevCMD.'))
  process.exit(1)
}
const OWNER_ID: string = OWNER.id

// ------------------------------------------------------------
// 4) shared helpers
// ------------------------------------------------------------

/** same lookup as the engine: @-stripped username OR email */
async function findUser(handle: string): Promise<User | null> {
  const clean = (handle || '').replace(/^@/, '').trim().toLowerCase()
  if (!clean) return null
  return (
    (await db.user.findUnique({ where: { username: clean } })) ||
    (await db.user.findFirst({ where: { email: clean } })) ||
    null
  )
}

/** CLI mutations land in the audit trail (ip marks the terminal source) */
async function cliAudit(action: string, meta: Record<string, unknown>): Promise<void> {
  try {
    await db.auditLog.create({
      data: { id: newId(), userId: OWNER_ID, action, ip: 'cli', meta: JSON.stringify(meta) },
    })
  } catch {
    /* fire-and-forget by design */
  }
}

async function realtimeUp(): Promise<boolean> {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 900)
    const r = await fetch(`http://localhost:${process.env.MEEV_REALTIME_PORT || 3003}/health`, { signal: ac.signal })
    clearTimeout(t)
    return r.ok
  } catch {
    return false
  }
}

/** colorize engine results by their leading marker */
function printResult(res: { ok: boolean; lines: string[] }): void {
  for (const line of res.lines) {
    if (/^[✅🎉🗑️🔊]/.test(line)) console.log(green(line))
    else if (line.startsWith('⛔')) console.log(red(line))
    else if (/^[⚠️ℹ️]/.test(line)) console.log(yellow(line))
    else console.log(line)
  }
}

function colorRole(role: string, s: string): string {
  if (role === 'owner') return gold(s)
  if (role === 'superadmin') return magenta(s)
  if (role === 'admin') return magenta(s)
  if (role === 'moderator') return green(s)
  if (role === 'support') return cyan(s)
  return s
}

// commands owned by the engine (runAdminCommand) — anything else CLI-side
const ENGINE_CMDS = new Set([
  'tickets', 'ticket', 'reply', // v19 support desk — work in-app AND here
  'whois', 'mute', 'unmute', 'ban', 'unban', 'verify', 'unverify', 'coins', 'strikes', 'clear', 'role', 'delete',
])

// ------------------------------------------------------------
// 5) CLI-only commands (owner powers — the DB-level manual path)
// ------------------------------------------------------------

async function cmdOwner(args: string[]): Promise<boolean> {
  if (!args[0]) {
    console.log(red('⛔ الصيغة: owner <username> — حدد المستخدم / specify the user'))
    return false
  }
  const target = await findUser(args[0])
  if (!target) {
    console.log(red(`⛔ ما لقيت المستخدم ${args[0]} — user not found`))
    return false
  }
  if (target.role === 'owner') {
    console.log(yellow(`⚠️ @${target.username} مالك (owner) أصلاً — already an owner, nothing to do.`))
    return false
  }
  await db.user.update({ where: { id: target.id }, data: { role: 'owner' } })
  await cliAudit('cli_owner', { target: target.username, fromRole: target.role })
  notifyUser(target.id, 'system', '👑 تمت ترقيتك إلى مالك Meev!', 'لديك الآن كل صلاحيات المالك (rank 5).').catch(() => null)
  console.log(green(`✅ رتبة @${target.username} أصبحت owner (rank 5) — ${target.role} → owner.`))
  console.log(dim(`   لتجهيزه بالكامل (مستوى 999 + ذهب + كل المتجر) شغّل: owner-setup ${target.username}`))
  return true
}

async function cmdSuperadmin(args: string[]): Promise<boolean> {
  if (!args[0]) {
    console.log(red('⛔ الصيغة: superadmin <username> — حدد المستخدم / specify the user'))
    return false
  }
  const target = await findUser(args[0])
  if (!target) {
    console.log(red(`⛔ ما لقيت المستخدم ${args[0]} — user not found`))
    return false
  }
  if (target.role === 'owner') {
    console.log(red(`⛔ @${target.username} مالك (owner) — لا تُغيّر رتبة المالك من هنا / cannot change the owner's role.`))
    return false
  }
  if (target.role === 'superadmin') {
    console.log(yellow(`⚠️ @${target.username} سوبر أدمن أصلاً — already a superadmin.`))
    return false
  }
  await db.user.update({ where: { id: target.id }, data: { role: 'superadmin' } })
  await cliAudit('cli_superadmin', { target: target.username, fromRole: target.role })
  notifyUser(target.id, 'system', '⚡ رتبتك الجديدة: سوبر أدمن!', 'كل صلاحيات الإدارة + تعيين الرتب وحذف الحسابات.').catch(() => null)
  console.log(green(`✅ رتبة @${target.username} أصبحت superadmin (rank 4) — ${target.role} → superadmin.`))
  console.log(dim('   صلاحياته: كل أوامر الإدارة + role + delete (بدون تعيين owner).'))
  return true
}

async function cmdOwnerSetup(args: string[]): Promise<boolean> {
  if (!args[0]) {
    console.log(red('⛔ الصيغة: owner-setup <username|email> — حدد المستخدم / specify the user'))
    return false
  }
  const target = await findUser(args[0])
  if (!target) {
    console.log(red(`⛔ ما لقيت المستخدم ${args[0]} — user not found`))
    return false
  }

  const NEW_XP = 30000 // → level 999 (XP_PER_LEVEL = 24)
  const NEW_COINS = 999999
  const now = new Date()

  await db.user.update({
    where: { id: target.id },
    data: {
      role: 'owner',
      xp: NEW_XP,
      coins: NEW_COINS,
      verifiedAt: target.verifiedAt ?? now,
      avatarAnim: true,
      lastSpinAt: null,
    },
  })

  // full wardrobe: one UserItem per ShopCatalog row (unique userId+itemKey — idempotent)
  const catalog = await db.shopCatalog.findMany({ select: { key: true } })
  const owned = new Set(
    (await db.userItem.findMany({ where: { userId: target.id }, select: { itemKey: true } })).map((r) => r.itemKey),
  )
  let granted = 0
  for (const item of catalog) {
    if (owned.has(item.key)) continue
    try {
      await db.userItem.create({
        data: { id: newId(), userId: target.id, itemKey: item.key, equipped: false, acquiredAt: now },
      })
      granted++
    } catch {
      /* unique race — already owned, safe to skip */
    }
  }

  // coin ledger only when the balance actually grew
  if (NEW_COINS > target.coins) {
    await db.coinLog.create({
      data: {
        id: newId(),
        userId: target.id,
        delta: NEW_COINS - target.coins,
        reason: 'seed',
        balanceAfter: NEW_COINS,
        contextId: '',
      },
    })
  }

  await cliAudit('cli_owner_setup', {
    target: target.username,
    fromRole: target.role,
    xpFrom: target.xp,
    coinsFrom: target.coins,
    itemsGranted: granted,
    catalogSize: catalog.length,
  })

  const lvl = levelProgress(NEW_XP).level
  console.log(green(`✅ owner-setup تم لـ @${target.username} — التجهيز الكامل للمالك / full owner upgrade:`))
  console.log(`   الرتبة / role:       ${target.role} → owner`)
  console.log(`   الخبرة / xp:         ${target.xp} → ${NEW_XP}  (level ${lvl} — أسطورة 👑)`)
  console.log(`   الذهب / gold:        ${target.coins} → ${NEW_COINS} 🪙${NEW_COINS > target.coins ? ` (+${NEW_COINS - target.coins} في سجل العملات)` : ''}`)
  console.log(`   التوثيق / verified:  ✅ ${target.verifiedAt ? '(كان موثقاً بالفعل)' : '(توثيق جديد)'}`)
  console.log('   الأفاتار المتحرك / animated avatar: ✨ مفعّل')
  console.log('   عجلة الحظ / spin:    جاهزة للدوران الآن (صُفّر عدّاد الانتظار)')
  console.log(`   المتجر / shop:       مُنح ${granted} عنصر جديد${catalog.length ? ` من أصل ${catalog.length} في الكتالوج` : ''}`)
  console.log(dim('   audit: cli_owner_setup · CoinLog reason=seed'))
  return true
}

async function cmdUsers(args: string[]): Promise<boolean> {
  const n = clampInt(args[0], 15, 1, 100)
  const [rows, total] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: n,
      select: {
        username: true, role: true, xp: true, coins: true,
        verifiedAt: true, bannedUntil: true, mutedUntil: true, isBot: true, createdAt: true,
      },
    }),
    db.user.count(),
  ])
  console.log(head(`👤 أحدث ${n} مستخدم (الإجمالي ${total}) — latest users:`))
  const header =
    '  ' + pad('username', 18) + ' ' + pad('role', 10) + ' ' + padL('lvl', 4) + '  ' + padL('gold', 9) + '  ' + pad('joined (UTC)', 19)
  console.log(dim(header))
  console.log(dim('  ' + '─'.repeat(header.length - 2)))
  const now = Date.now()
  for (const u of rows) {
    const flags =
      [
        u.verifiedAt ? '✅' : '',
        u.bannedUntil && u.bannedUntil.getTime() > now ? '🚫' : '',
        u.mutedUntil && u.mutedUntil.getTime() > now ? '🔇' : '',
        u.isBot ? '🤖' : '',
      ]
        .filter(Boolean)
        .join(' ') || '—'
    console.log(
      '  ' +
        pad('@' + u.username, 18) +
        ' ' +
        colorRole(u.role, pad(u.role, 10)) +
        ' ' +
        padL(String(levelProgress(u.xp).level), 4) +
        '  ' +
        padL(String(u.coins), 9) +
        '  ' +
        dim(fmtTs(u.createdAt)) +
        '  ' +
        flags,
    )
  }
  console.log(dim('  ✅ موثّق · 🚫 محظور · 🔇 مكتوم · 🤖 بوت'))
  return true
}

async function cmdLogs(args: string[]): Promise<boolean> {
  const n = clampInt(args[0], 20, 1, 100)
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: n })
  const ids = [...new Set(rows.map((r) => r.userId).filter((v): v is string => !!v))]
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
    : []
  const names = new Map(users.map((u) => [u.id, u.username]))
  console.log(head(`📜 آخر ${n} سجل تدقيق — audit log (UTC):`))
  const header = '  ' + pad('time', 19) + '  ' + pad('action', 22) + '  ' + pad('actor', 14) + '  ' + pad('ip', 12) + ' meta'
  console.log(dim(header))
  console.log(dim('  ' + '─'.repeat(header.length - 2)))
  if (!rows.length) {
    console.log(yellow('  لا سجلات بعد — no audit entries yet.'))
    return true
  }
  for (const r of rows) {
    const actor = r.userId ? '@' + (names.get(r.userId) || r.userId.slice(0, 8)) : '—'
    let meta = ''
    try {
      meta = JSON.stringify(JSON.parse(r.meta || '{}'))
    } catch {
      meta = r.meta || ''
    }
    meta = meta.replace(/\s+/g, ' ')
    if (meta === '{}') meta = '—'
    if (meta.length > 48) meta = meta.slice(0, 47) + '…'
    const actionCol = r.action.startsWith('cli_') ? magenta(pad(r.action, 22)) : cyan(pad(r.action, 22))
    console.log(
      '  ' + dim(fmtTs(r.createdAt)) + '  ' + actionCol + '  ' + green(pad(actor, 14)) + '  ' + dim(pad(r.ip || '—', 12)) + ' ' + dim(meta),
    )
  }
  return true
}

async function cmdSessions(args: string[]): Promise<boolean> {
  if (!args[0]) {
    console.log(red('⛔ الصيغة: sessions <username> [revoke]'))
    return false
  }
  const target = await findUser(args[0])
  if (!target) {
    console.log(red(`⛔ ما لقيت المستخدم ${args[0]} — user not found`))
    return false
  }

  if ((args[1] || '').toLowerCase() === 'revoke') {
    const now = new Date()
    const s = await db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } })
    const t = await db.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } })
    broadcast(`user:${target.id}`, 'socket:force-signout', { reason: 'cli-sessions-revoke' }).catch(() => null)
    await cliAudit('cli_sessions_revoke', { target: target.username, sessions: s.count, refreshTokens: t.count })
    console.log(green(`✅ انتهيت ${s.count} جلسة و ${t.count} رمز تحديث لـ @${target.username} — طُرد من كل الأجهزة.`))
    console.log(dim('   sessions + refresh tokens revoked · force-signout broadcast (best-effort).'))
    return true
  }
  if (args[1]) {
    console.log(yellow(`⚠️ خيار غير معروف "${args[1]}" — الاستخدام: sessions <user> [revoke]`))
    return false
  }

  const active = await db.session.findMany({
    where: { userId: target.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
  })
  console.log(head(`🖥️ جلسات @${target.username} النشطة — active sessions:`))
  if (!active.length) {
    console.log(yellow('   لا جلسات نشطة الآن — no active sessions.'))
    return true
  }
  const header =
    '  ' + pad('device', 20) + '  ' + pad('ip', 16) + '  ' + pad('last seen (UTC)', 19) + '  ' + pad('created (UTC)', 19)
  console.log(dim(header))
  console.log(dim('  ' + '─'.repeat(header.length - 2)))
  for (const s of active) {
    console.log(
      '  ' + pad(s.device || '—', 20) + '  ' + pad(s.ip || '—', 16) + '  ' + dim(fmtTs(s.lastSeenAt)) + '  ' + dim(fmtTs(s.createdAt)),
    )
  }
  console.log(dim(`  ${active.length} جلسة نشطة — مرتبة حسب آخر ظهور.`))
  return true
}

async function cmdPassreset(args: string[]): Promise<boolean> {
  if (args.length < 2) {
    console.log(red('⛔ الصيغة: passreset <username> <newPassword> — كلمة المرور الجديدة مطلوبة'))
    return false
  }
  const target = await findUser(args[0])
  if (!target) {
    console.log(red(`⛔ ما لقيت المستخدم ${args[0]} — user not found`))
    return false
  }
  const pw = args.slice(1).join(' ')
  const issue = checkPasswordStrength(pw)
  if (issue) {
    console.log(red(`⛔ كلمة المرور ضعيفة / weak password — ${issue}`))
    console.log(yellow('   الحد الأدنى: 8 أحرف + صغيرة + كبيرة + رقم + رمز / needs lower+upper+digit+symbol.'))
    return false
  }
  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: hashPassword(pw), failedLogins: 0, lockedUntil: null },
  })
  const now = new Date()
  const s = await db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } })
  const t = await db.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } })
  broadcast(`user:${target.id}`, 'socket:force-signout', { reason: 'cli-passreset' }).catch(() => null)
  notifyUser(
    target.id,
    'system',
    '🔐 تم تغيير كلمة مرورك',
    'لأسباب أمنية أنهينا جميع جلساتك — سجّل دخولك من جديد.',
  ).catch(() => null)
  await cliAudit('cli_passreset', {
    target: target.username,
    sessionsRevoked: s.count,
    refreshTokensRevoked: t.count,
  })
  console.log(green(`✅ أُعيد تعيين كلمة مرور @${target.username} — انتهيت ${s.count} جلسة و ${t.count} رمز تحديث.`))
  console.log(dim('   كلمة المرور لا تُطبع ولا تُخزَّن في سجل الأوامر / the password is never echoed or kept in history.'))
  return true
}

// ------------------------------------------------------------
// 6) HELP — engine HELP_LINES merged with the CLI-only commands
// ------------------------------------------------------------
async function cmdHelp(): Promise<boolean> {
  const engine = await runAdminCommand(OWNER!, 'help')
  const cmdLines = engine.lines.filter((l) => /^[a-z]+ +/.test(l))
  const roleLine = engine.lines.find((l) => l.startsWith('رتبتك')) || ''

  const ownerCmds = cmdLines.filter((l) => /^(role|delete) /.test(l))
  const staffCmds = cmdLines.filter((l) => !/^(role|delete) /.test(l))

  console.log(head('MeevCMD v19 — كل الأوامر / all commands'))
  console.log(dim('═'.repeat(64)))
  console.log(bold('👥 فريق الإدارة / staff commands — من support فأعلى:'))
  for (const l of staffCmds) console.log('  ' + l)
  console.log()
  console.log(bold('👑 المالك فقط / owner & superadmin (rank 4+):'))
  for (const l of ownerCmds) console.log('  ' + l)
  console.log()
  console.log(bold('🖥️ أوامر الطرفية فقط / CLI-only — bun meev-cli.ts:'))
  console.log('  owner        <username>       — تعيين رتبة مالك (rank 5) / grant owner role')
  console.log('  superadmin   <username>       — تعيين سوبر أدمن (rank 4) / grant superadmin role')
  console.log('  owner-setup  <user|email>     — تجهيز المالك الكامل: رتبة owner + مستوى 999 + 999,999 ذهب + كل المتجر / full upgrade')
  console.log('  users        [n]              — أحدث n مستخدم (افتراضي 15) / latest users table')
  console.log('  logs         [n]              — آخر n سجلات تدقيق (افتراضي 20) / audit log')
  console.log('  sessions     <user> [revoke]  — عرض الجلسات النشطة أو إنهاؤها / list or revoke sessions')
  console.log('  passreset    <user> <newPass> — إعادة تعيين كلمة المرور / password reset')
  console.log('  cls                           — مسح الشاشة / clear the screen')
  console.log('  exit | quit                   — الخروج من الطرفية / leave the terminal')
  console.log(dim('─'.repeat(64)))
  if (roleLine) console.log(yellow(roleLine))
  console.log(dim('أوامر المحرك تعمل داخل التطبيق وهنا / engine commands work in-app and here; CLI-only هنا فقط.'))
  return true
}

// ------------------------------------------------------------
// 7) dispatcher — never crashes the caller
// ------------------------------------------------------------
async function runCommand(input: string): Promise<boolean> {
  const line = input.trim()
  if (!line) return true
  const parts = line.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  try {
    if (cmd === 'help') return await cmdHelp()
    if (cmd === 'cls' || cmd === 'clear-screen') {
      console.clear()
      return true
    }
    if (cmd === 'owner') return await cmdOwner(args)
    if (cmd === 'superadmin') return await cmdSuperadmin(args)
    if (cmd === 'owner-setup') return await cmdOwnerSetup(args)
    if (cmd === 'users') return await cmdUsers(args)
    if (cmd === 'logs') return await cmdLogs(args)
    if (cmd === 'sessions') return await cmdSessions(args)
    if (cmd === 'passreset') return await cmdPassreset(args)

    if (ENGINE_CMDS.has(cmd)) {
      const res = await runAdminCommand(OWNER!, line)
      printResult(res)
      return res.ok
    }

    console.log(red(`⛔ أمر غير معروف: "${cmd}" — unknown command`))
    await cmdHelp()
    return false
  } catch (e) {
    console.error(red(`⛔ فشل تنفيذ "${cmd}": ${msg(e)}`))
    console.error(dim('   الطرفية ما زالت تعمل / the terminal keeps running.'))
    return false
  }
}

// ------------------------------------------------------------
// 8) banner / goodbye / usage
// ------------------------------------------------------------
const CAT: string[] = [
  '    /\\___/\\    ',
  '   /       \\   ',
  '  |  o   o  |  ',
  '--|    <    |--',
  '--|  \\___/  |--',
  '   \\_______/   ',
  '    /\\/\\/\\/\\  ',
]

function goodbye(): void {
  console.log()
  console.log(dim('─'.repeat(48)))
  console.log(cyan('👋 مع السلامة يا مالك Meev — إلى اللقاء!'))
  console.log(dim('   goodbye, owner of Meev — MeevCMD closed.'))
}

async function printBanner(): Promise<void> {
  for (const l of CAT) console.log(cyan(l))
  console.log(gold('  MeevCMD v19 — Owner Terminal · طرفية ميف للمالك'))
  console.log(dim('  ' + '─'.repeat(48)))
  console.log(dim(`  🔗 db      ${(process.env.DATABASE_URL || '').replace(/^file:/, '') || '(DATABASE_URL)'}`))
  console.log(`  👤 owner   ${gold('@' + OWNER!.username)} — ${OWNER!.displayName} <${OWNER!.email}>`)
  console.log(`  👑 role    ${yellow(OWNER!.role)} (rank 4 — كل الصلاحيات / all powers)`)
  const rt = await realtimeUp()
  console.log(
    dim(
      `  ⚡ realtime :${process.env.MEEV_REALTIME_PORT || 3003} — ${
        rt ? 'connected ✓' : 'offline (الإشعارات تُخزَّن وتُسلَّم لاحقاً)'
      }`,
    ),
  )
  console.log(dim('  ' + '─'.repeat(48)))
  console.log(yellow('  💡 لمنح الرتب / to grant staff roles:'))
  console.log('     role @user support · role @user moderator · role @user admin')
  console.log(yellow('  💡 owner-setup يمنح صلاحيات المالك الكاملة (مستوى 999 + 999,999 ذهب + كل المتجر)'))
  console.log(dim('     owner-setup <username> grants the full 999 owner powers.'))
  console.log(dim('  اكتب help لعرض كل الأوامر — type help for all commands.'))
  console.log()
}

function usage(): void {
  console.log(head('MeevCMD v19 — Meev owner terminal'))
  console.log('الاستخدام / usage:')
  console.log('  bun meev-cli.ts                      → طرفية تفاعلية / interactive REPL')
  console.log('  bun meev-cli.ts "whois @mochi"       → أمر واحد / one-shot command')
  console.log('  bun meev-cli.ts "logs 10"            → آخر 10 سجلات تدقيق')
  console.log('CLI-only: owner · owner-setup · users · logs · sessions · passreset · help')
}

// ------------------------------------------------------------
// 9) REPL — history ↑/↓, Ctrl+C/Ctrl+D, never crashes
// ------------------------------------------------------------
const PROMPT = COLOR ? '\x1b[1;36mmeev>\x1b[0m ' : 'meev> '

async function repl(): Promise<void> {
  // NOTE: no awaits may sit between createInterface and the for-await loop,
  // otherwise pre-buffered piped stdin lines get dropped (bun quirk) —
  // so the async banner runs BEFORE the interface is created.
  let rl: readline.Interface | null = null
  let leaving = false
  const leave = (code = 0): void => {
    if (leaving) return
    leaving = true
    goodbye()
    try {
      rl?.close()
    } catch {
      /* already closed */
    }
    try {
      void db.$disconnect()
    } catch {
      /* best effort */
    }
    process.exit(code)
  }
  // covers Ctrl+C during the banner AND during command execution (cooked mode)
  process.on('SIGINT', () => leave(0))

  await printBanner()

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    historySize: 100,
  })
  const history = () => (rl as unknown as { history: string[] }).history
  // covers Ctrl+C while the prompt is reading (terminal raw mode)
  rl.on('SIGINT', () => leave(0))

  rl.prompt()

  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) {
      // passwords never linger in command history
      if (/^passreset\b/i.test(trimmed)) {
        const h = history()
        const idx = h.lastIndexOf(line)
        if (idx >= 0) h.splice(idx, 1)
      }
      if (/^(exit|quit)$/i.test(trimmed)) {
        leave(0)
        return
      }
      await runCommand(trimmed) // runCommand catches everything itself
    }
    if (!leaving) rl.prompt()
  }
  leave(0) // Ctrl+D / EOF
}

// ------------------------------------------------------------
// 10) entry — one-shot vs interactive
// ------------------------------------------------------------
const argv = process.argv.slice(2)
if (argv[0] === '--help' || argv[0] === '-h') {
  usage()
  process.exit(0)
}

if (argv.length) {
  // one-shot: bun meev-cli.ts "whois @mochi"  (or argv-style)
  const line = argv.join(' ').trim()
  console.log(dim(`MeevCMD v19 · ${gold('@' + OWNER!.username)} (${OWNER!.role}) → ${line}`))
  if (/^(exit|quit)$/i.test(line)) {
    goodbye()
    process.exit(0)
  }
  let ok = true
  try {
    ok = await runCommand(line)
  } catch (e) {
    console.error(red(`⛔ خطأ: ${msg(e)}`))
    ok = false
  }
  try {
    void db.$disconnect()
  } catch {
    /* best effort */
  }
  process.exit(ok ? 0 : 1)
}

await repl()
