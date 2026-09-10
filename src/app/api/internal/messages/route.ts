import { requireServiceKey, unauthorized } from '@/lib/meev/auth'
import { readJson, serverError } from '@/lib/meev/guard'
import { createMessage, MessageError } from '@/lib/meev/messages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!requireServiceKey(req)) return unauthorized()
  try {
    const body = await readJson(req)
    const scope = body.scope === 'server' ? 'server' : 'dm'

    try {
      const message = await createMessage({
        scope,
        conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
        channelId: typeof body.channelId === 'string' ? body.channelId : null,
        authorId: typeof body.authorId === 'string' ? body.authorId : '',
        content: typeof body.content === 'string' ? body.content : '',
        kind: typeof body.kind === 'string' ? body.kind : 'text',
        attachmentUrl: typeof body.attachmentUrl === 'string' ? body.attachmentUrl : null,
        meta: (body.meta && typeof body.meta === 'object' ? body.meta : null) as Record<string, unknown> | null,
      })
      // createMessage already returns the full MessageDTO (author + reactions + parsed meta)
      return Response.json({ message })
    } catch (err) {
      if (err instanceof MessageError) {
        return Response.json({ error: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (err) {
    return serverError(err)
  }
}
