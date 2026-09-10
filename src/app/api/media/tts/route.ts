import fs from 'node:fs'
import path from 'node:path'
import ZAI from 'z-ai-web-dev-sdk'
import { newId } from '@/lib/meev/ids'
import { guard, readJson, badRequest } from '@/lib/meev/guard'
import { sanitizeText } from '@/lib/meev/sanitize'
import { rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    const rl = rateLimit(`tts:${g.user.id}`, 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    const body = await readJson(req)
    const text = sanitizeText(body.text, 'message', 280)
    if (text.length < 1) return badRequest('Text is required (max 280 characters)')

    const zai = await ZAI.create()
    // NOTE: the live SDK backend currently rejects response_format 'mp3'
    // (error 1214) — 'wav' is the only reliably supported non-streaming
    // format, and the TTS skill examples use it too. Deviation from the
    // contract's ".mp3" noted in the worklog.
    const response = await zai.audio.tts.create({
      input: text,
      voice: 'tongtong',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    })
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    if (buffer.length === 0) {
      return Response.json({ error: 'Voice synthesis failed, try again' }, { status: 500 })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const id = newId()
    const filename = `tts_${id}.wav`
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)

    return Response.json({ audioUrl: `/uploads/${filename}` })
  } catch {
    return Response.json({ error: 'Voice synthesis failed, try again' }, { status: 500 })
  }
}
