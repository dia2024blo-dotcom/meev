// MEEV v19 — Support tickets: the full support-desk cycle.
// POST /api/support { subject, category, message } → { ticket }
//   A new ticket lands at the desk as 🆕 OPEN (awaiting a HUMAN reply) with
//   an instant bilingual auto-ack stored in `autoReply`. Staff (support+)
//   answer it from MeevCMD (`reply <id> <text>`) — that reply REPLACES the
//   auto-ack in the user's «تذاكري» thread, flips status to ✅ answered and
//   pushes an instant notification.
// GET /api/support → { tickets }

import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { filterProfanity } from '@/lib/meev/profanity'
import { notifyUser } from '@/lib/meev/realtime'
import { SUPPORT_CATEGORIES } from '@/lib/meev/constants'
import type { SupportTicket } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORY_KEYS = new Set(SUPPORT_CATEGORIES.map((c) => c.key))

function ticketDto(t: SupportTicket) {
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    message: t.message,
    autoReply: t.autoReply,
    reply: t.reply,
    status: t.status as 'open' | 'answered',
    createdAt: t.createdAt.toISOString(),
    repliedAt: t.repliedAt ? t.repliedAt.toISOString() : null,
  }
}

// The instant auto-ack — comfort while a human picks the ticket up. It is
// shown in the user's thread UNTIL a staff member replies (the human answer
// replaces it, per the desk workflow).
const AUTO_REPLY =
  'وصلت تذكرتك فوراً إلى مكتب الدعم 🐾 — هذا رد آلي فوري لتطمينك، وسيرد عليك أحد أعضاء الفريق قريباً. ' +
  '/ Your ticket landed at the Meev support desk instantly 🐾 — this is an automatic acknowledgement; a member of the team will reply to you shortly. — فريق ميف / Meev Support'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    // v6 anti-spam: ONE ticket per week per user (tickets are human-reviewed;
    // a real conversation continues inside the existing ticket, not new ones)
    const WEEK_MS = 7 * 86400_000
    const lastTicket = await db.supportTicket.findFirst({
      where: { userId: g.user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastTicket) {
      const elapsed = Date.now() - lastTicket.createdAt.getTime()
      if (elapsed < WEEK_MS) {
        const daysLeft = Math.ceil((WEEK_MS - elapsed) / 86400_000)
        return Response.json(
          {
            error: `فتحت تذكرة قبل ${Math.floor(elapsed / 86400_000) || 'أقل من يوم'} — يمكن فتح تذكرة جديدة بعد ${daysLeft} يوم. استمر في نفس التذكرة للردود / You opened a ticket recently — you can open a new one in ${daysLeft} day(s). Continue the conversation inside your existing ticket for replies`,
          },
          { status: 429 },
        )
      }
    }
    // hard spam ceiling as well: 3 / hour (e.g. after the week resets)
    const rl = rateLimit(`support:${g.user.id}`, 3, 3600_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const subject = filterProfanity(sanitizeText(body.subject, 'subject', 120))
    const message = filterProfanity(sanitizeText(body.message, 'message', 2000))
    const category =
      typeof body.category === 'string' && CATEGORY_KEYS.has(body.category) ? body.category : 'other'

    if (subject.text.length < 1) return badRequest('Subject is required (1-120 characters)')
    if (message.text.length < 1) return badRequest('Message is required (1-2000 characters)')
    // profanity gate: hard abuse is rejected outright, soft words are masked
    if (subject.hard || message.hard) {
      return badRequest('نعتذر، رسالة الدعم تحتوي كلمات لا نقبلها 🙈 / Your message contains words we cannot accept 🙈')
    }

    const ticket = await db.supportTicket.create({
      data: {
        id: newId(),
        userId: g.user.id,
        subject: subject.text,
        category,
        message: message.text,
        autoReply: AUTO_REPLY,
        reply: '',
        repliedById: '',
        status: 'open', // 🆕 waiting for a human at the desk
      },
    })

    // let the user know their ticket landed at the desk (notification + realtime push)
    await notifyUser(
      g.user.id,
      'system',
      '📩 وصلت تذكرتك إلى مكتب الدعم',
      `«${subject.text}» — الرد الآلي ظاهر في «تذاكري» وسيرد عليك الفريق قريباً.`,
      {
        ticketId: ticket.id,
        category,
      },
    ).catch(() => null)

    return Response.json({ ticket: ticketDto(ticket) })
  } catch (err) {
    return serverError(err)
  }
}

export async function GET(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const tickets = await db.supportTicket.findMany({
      where: { userId: g.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return Response.json({ tickets: tickets.map(ticketDto) })
  } catch (err) {
    return serverError(err)
  }
}
