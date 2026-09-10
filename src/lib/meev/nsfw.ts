// MEEV v5 — AI NSFW moderation for uploaded images.
// Uses the vision model (z-ai-web-dev-sdk, backend-only) to classify each
// upload as safe / adult / borderline. Fail-open on service errors (a flaky
// check must never block legitimate uploads), but every flagged verdict is
// audited and the upload rejected.

import ZAI from 'z-ai-web-dev-sdk'

export type NsfwVerdict = {
  flagged: boolean
  label: 'safe' | 'adult' | 'borderline'
  reason: string
}

let zaiPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null

async function getClient() {
  if (!zaiPromise) {
    zaiPromise = ZAI.create().catch(() => null as unknown as Awaited<ReturnType<typeof ZAI.create>>)
  }
  return zaiPromise
}

/**
 * Classify an image buffer. Returns { flagged: false, label: 'safe' } on any
 * service failure (fail-open) — moderation still catches abuse via reports
 * and the community rules engine.
 */
export async function checkImageSafety(buf: Buffer, mime: string): Promise<NsfwVerdict> {
  const safe: NsfwVerdict = { flagged: false, label: 'safe', reason: 'not checked' }
  try {
    const client = await getClient()
    if (!client) return safe

    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    const response = await Promise.race([
      client.chat.completions.createVision({
        // explicit vision model (the SDK's body type requires one)
        model: 'glm-4.5v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are an image safety classifier. Answer with exactly one word: SAFE if the image contains no nudity, pornography, sexual acts, or adults-only sexual content. ADULT if it contains nudity, pornography or sexual content. BORDERLINE if it is suggestive but not explicit. Answer with one word only.',
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ])
    if (!response) return safe

    const answer = (response.choices[0]?.message?.content || '').trim().toUpperCase()
    if (answer.includes('ADULT')) {
      return { flagged: true, label: 'adult', reason: 'nudity / sexual content' }
    }
    if (answer.includes('BORDERLINE')) {
      return { flagged: false, label: 'borderline', reason: 'suggestive but not explicit — allowed' }
    }
    return { flagged: false, label: 'safe', reason: 'classified safe' }
  } catch {
    return safe
  }
}
