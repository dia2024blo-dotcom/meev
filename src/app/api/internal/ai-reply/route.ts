import ZAI from 'z-ai-web-dev-sdk'
import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_REPLY = '😹 I zoned out for a second — say that again?'

const SYSTEM_PROMPT =
  'You are a friendly, playful stranger chatting 1v1 on Meev, a cozy social app. ' +
  'Keep replies short — 1 to 3 sentences. Match the user\'s language: if they write Arabic reply in Arabic, if English reply in English. ' +
  'Never reveal that you are an AI unless asked directly. Keep everything SFW. ' +
  'Never ask for personal data like addresses, passwords or phone numbers.'

type HistoryItem = { role: 'user' | 'stranger'; content: string }

export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const rawHistory = Array.isArray(body.history) ? (body.history as HistoryItem[]) : []
    const history = rawHistory
      .filter((h) => h && typeof h.content === 'string' && (h.role === 'user' || h.role === 'stranger'))
      .slice(-20)
      .map((h) => ({ role: h.role, content: sanitizeText(h.content, 'message', 1000) }))

    const strangerPersona =
      typeof body.strangerPersona === 'string' && body.strangerPersona.trim()
        ? sanitizeText(body.strangerPersona, 'message', 200)
        : ''

    const messages = [
      {
        role: 'assistant' as const,
        content: strangerPersona ? `${SYSTEM_PROMPT} Your persona for this chat: ${strangerPersona}` : SYSTEM_PROMPT,
      },
      ...history.map((h) => ({
        role: (h.role === 'stranger' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.content,
      })),
    ]

    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      })
      const reply = completion.choices[0]?.message?.content
      if (!reply || !reply.trim()) return Response.json({ reply: FALLBACK_REPLY })
      return Response.json({ reply: reply.trim().slice(0, 500) })
    } catch {
      // never 500 per contract
      return Response.json({ reply: FALLBACK_REPLY })
    }
  } catch {
    return Response.json({ reply: FALLBACK_REPLY })
  }
}
