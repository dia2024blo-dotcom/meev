import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { guard, serverError, notFound, forbidden, badRequest, readJson } from '@/lib/meev/guard'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================
// v7 — REAL-TIME DM TRANSLATION (ترجمة فورية في الخاص)
// POST /api/dms/:id/translate { messageId }
// Translates a chat message's content into the CALLER's app
// language using the LLM, with an in-memory cache so the same
// message never costs two calls. Only conversation participants
// can translate, only text-kind messages, and the source text is
// clamped before it reaches the model.
// ============================================================

const LANG_LABELS: Record<string, string> = {
  ar: 'Arabic (العربية)',
  en: 'English',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  tr: 'Turkish (Türkçe)',
  de: 'German (Deutsch)',
}

/** messageId:lang → translation (simple LRU-ish map, capped) */
const CACHE = new Map<string, string>()
const CACHE_CAP = 800
function cacheGet(key: string): string | undefined {
  const v = CACHE.get(key)
  if (v !== undefined) {
    CACHE.delete(key)
    CACHE.set(key, v) // refresh recency
  }
  return v
}
function cacheSet(key: string, value: string) {
  if (CACHE.size >= CACHE_CAP) {
    const oldest = CACHE.keys().next().value
    if (oldest !== undefined) CACHE.delete(oldest)
  }
  CACHE.set(key, value)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    // translation abuse guard: 30 / minute per user
    const rl = rateLimit(`translate:${g.user.id}`, 30, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const { id } = await ctx.params
    const body = await readJson(req).catch(() => null)
    const messageId =
      body && typeof (body as Record<string, unknown>).messageId === 'string' ? (body as Record<string, string>).messageId : ''
    if (!messageId) return badRequest('messageId is required')

    const lang = LANG_LABELS[g.user.lang] ? g.user.lang : 'en'
    const cacheKey = `${messageId}:${lang}`
    const cached = cacheGet(cacheKey)
    if (cached) return Response.json({ translation: cached, cached: true })

    const conv = await db.dMConversation.findUnique({ where: { id } })
    if (!conv) return notFound('Conversation not found')
    if (conv.userAId !== g.user.id && conv.userBId !== g.user.id) {
      return forbidden('You are not a participant in this conversation')
    }

    const msg = await db.message.findFirst({ where: { id: messageId, conversationId: id } })
    if (!msg) return notFound('Message not found')
    if (msg.kind !== 'text') return badRequest('Only text messages can be translated')
    const text = (msg.content || '').trim().slice(0, 1000)
    if (!text) return badRequest('Nothing to translate')

    // trivial no-op guard: pure emoji / single-token messages skip the model
    if (text.length <= 2) return Response.json({ translation: text, cached: false })

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system' as const,
            content:
              'You are a translation engine inside a chat app. Translate the user message into ' +
              LANG_LABELS[lang] +
              '. Output ONLY the translation as plain text — no quotes, no explanations, no language names, no notes. ' +
              'Preserve emojis, names, mentions (@user), URLs, numbers and line breaks exactly as they are. ' +
              'Keep the tone casual and natural like a real chat. If the text is already in the target language, return it unchanged.',
          },
          { role: 'user' as const, content: text },
        ],
        thinking: { type: 'disabled' },
      })
      let translation = (completion.choices[0]?.message?.content || '').trim()
      // strip wrapping quotes the model sometimes adds
      translation = translation.replace(/^["“”«»']+|["“”«»']+$/g, '').trim()
      if (!translation) translation = text
      cacheSet(cacheKey, translation.slice(0, 1200))
      return Response.json({ translation: translation.slice(0, 1200) })
    } catch {
      // model unavailable → graceful degradation, the UI shows a retry hint
      return Response.json({ error: 'translation_unavailable' }, { status: 503 })
    }
  } catch (err) {
    return serverError(err)
  }
}
