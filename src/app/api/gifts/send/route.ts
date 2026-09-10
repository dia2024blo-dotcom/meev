import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, serverError, badRequest, notFound, forbidden } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { filterProfanity } from '@/lib/meev/profanity'
import { broadcast, notifyUser } from '@/lib/meev/realtime'
import { createMessage, MessageError } from '@/lib/meev/messages'
import { giftDto } from '@/lib/meev/dto'
import { GIFT_DAILY_LIMIT } from '@/lib/meev/constants'
import { spendCoins, grantCoins, CoinError } from '@/lib/meev/coins'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const me = g.user
    // gift spam + economy guard: burst limiter on top of the 24/24h rule
    const rl = rateLimit(`gift-send:${me.id}`, 15, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const giftKey = typeof body.giftKey === 'string' ? body.giftKey : ''
    const recipientId = typeof body.recipientId === 'string' ? body.recipientId : ''
    // gift notes are user-typed text — soft profanity is masked
    // with 🙈, hard abuse rejects the send (note rides the Gift row, the
    // notification body and the gift message meta — all use the masked text)
    const noteRaw = sanitizeText(body.note, 'note', 30) // gift note = 30 chars (user spec)
    const noteFiltered = filterProfanity(noteRaw)
    if (noteFiltered.hard) {
      return badRequest('نعتذر، ملاحظة الهدية تحتوي كلمات لا نقبلها 🙈 / That gift note contains words we cannot accept 🙈')
    }
    const note = noteFiltered.text

    // v16 (user spec): gifts exist ONLY in private (DM) and live rooms —
    // never on posts. Anything that is not exactly 'live' is a private gift.
    const contextType: 'dm' | 'live' = body.contextType === 'live' ? 'live' : 'dm'
    const contextId = typeof body.contextId === 'string' ? body.contextId : ''

    if (!giftKey) return badRequest('giftKey is required')
    if (!recipientId) return badRequest('recipientId is required')

    const gift = await db.giftCatalog.findUnique({ where: { key: giftKey } })
    if (!gift) return notFound('Gift not found')

    const recipient = await db.user.findUnique({ where: { id: recipientId } })
    if (!recipient) return notFound('Recipient not found')
    if (recipient.id === me.id) return badRequest('You cannot send a gift to yourself')

    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: me.id, blockedId: recipient.id },
          { blockerId: recipient.id, blockedId: me.id },
        ],
      },
    })
    if (blocked) return forbidden('You cannot send a gift to this user')

    // v16 (user spec): the hard daily gift budget — 24 gifts per rolling
    // 24h window, counted from the sender's Gift ledger.
    const since = new Date(Date.now() - 24 * 3600_000)
    const sentLast24h = await db.gift.count({ where: { senderId: me.id, createdAt: { gte: since } } })
    if (sentLast24h >= GIFT_DAILY_LIMIT) {
      return Response.json(
        {
          error: `الحد اليومي: ${GIFT_DAILY_LIMIT} هدية كل ٢٤ ساعة — عد لاحقاً 🐾 / Daily gift limit: ${GIFT_DAILY_LIMIT} gifts every 24h — come back later 🐾`,
          limit: GIFT_DAILY_LIMIT,
        },
        { status: 400 },
      )
    }

    // a private gift always lands in the DM thread — resolve (or open) the
    // conversation between the two users so the gift message has a home.
    let conversationId: string | null = null
    if (contextType === 'dm') {
      if (contextId) {
        const conv = await db.dMConversation.findUnique({ where: { id: contextId } })
        if (!conv || (conv.userAId !== me.id && conv.userBId !== me.id)) {
          return badRequest('Invalid gift context')
        }
        conversationId = conv.id
      } else {
        const userAId = me.id < recipient.id ? me.id : recipient.id
        const userBId = me.id < recipient.id ? recipient.id : me.id
        const existing = await db.dMConversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } })
        conversationId = existing
          ? existing.id
          : (await db.dMConversation.create({ data: { id: newId(), userAId, userBId } })).id
      }
    }

    const freshMe = await db.user.findUniqueOrThrow({ where: { id: me.id } })
    if (freshMe.coins < gift.price) {
      return Response.json({ error: 'Not enough Gold Meev 🪙 — stay active on Meev and receive gifts to earn more' }, { status: 400 })
    }

    // atomic deduct (conditional UPDATE → no double-spend races) + ledger
    await spendCoins(me.id, gift.price, 'gift_sent', giftKey)

    // v16 (user spec): a sent gift IS the currency transfer — the recipient's
    // account is credited the full coin value the moment the gift is sent.
    await grantCoins(recipient.id, gift.price, 'gift_received', giftKey)

    const giftRow = await db.gift.create({
      data: {
        id: newId(),
        senderId: me.id,
        recipientId: recipient.id,
        giftKey: gift.key,
        coins: gift.price,
        note,
        contextType,
        contextId: contextType === 'live' ? contextId : (conversationId ?? ''),
      },
      include: { sender: true, recipient: true },
    })
    const dto = giftDto(giftRow, gift)

    // (v16: NO XP for gifts — levels come only from hours of interaction)

    // notify + realtime push to the recipient
    await notifyUser(
      recipient.id,
      'gift',
      `${me.displayName} sent you a ${gift.name}!`,
      note,
      { giftId: giftRow.id, giftKey: gift.key, senderId: me.id, coins: gift.price }
    )
    await broadcast(`user:${recipient.id}`, 'gift:received', { gift: dto, coinsCredited: gift.price })
    await broadcast(`user:${recipient.id}`, 'coins:changed', { coins: recipient.coins + gift.price, reason: 'gift_received', delta: gift.price })

    // persist the clean gift sticker in the DM + broadcast dm:new
    if (contextType === 'dm' && conversationId) {
      try {
        const message = await createMessage({
          scope: 'dm',
          conversationId,
          authorId: me.id,
          content: `🎁 ${me.displayName} → ${gift.name} · +${gift.price} 🪙`,
          kind: 'gift',
          meta: { giftKey: gift.key, note, coins: gift.price },
          processCommands: false,
        })
        await broadcast(`dm:${conversationId}`, 'dm:new', { message, conversationId })
        const conv = await db.dMConversation.findUnique({ where: { id: conversationId } })
        if (conv) {
          const partnerId = conv.userAId === me.id ? conv.userBId : conv.userAId
          await broadcast(`user:${partnerId}`, 'dm:new', { message, conversationId })
        }
      } catch {
        // gift message persistence failure must not fail the gift itself
      }
    }

    // 'gifted' badge for sender on first gift
    const hasBadge = await db.userBadge.findFirst({ where: { userId: me.id, badgeKey: 'gifted' } })
    if (!hasBadge) {
      await db.userBadge.create({ data: { id: newId(), userId: me.id, badgeKey: 'gifted' } }).catch(() => null)
    }

    return Response.json({
      gift: dto,
      coinsCredited: gift.price,
      remainingToday: Math.max(0, GIFT_DAILY_LIMIT - (sentLast24h + 1)),
      coinsLeft: await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { coins: true } }).then((u) => u.coins),
    })
  } catch (err) {
    if (err instanceof MessageError) {
      return Response.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof CoinError) {
      return Response.json({ error: 'Not enough Gold Meev 🪙 — stay active on Meev and receive gifts to earn more' }, { status: 400 })
    }
    return serverError()
  }
}
