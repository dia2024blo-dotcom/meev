// MEEV — Realtime bridge: POSTs broadcasts to the socket.io mini-service
// on :3003. The service may be down (built in parallel) — every call is
// fire-and-forget with a 1.5s abort timeout so the API NEVER fails because
// of realtime delivery.

import { db } from '@/lib/db'
import { newId } from './ids'

const SERVICE_KEY = process.env.MEEV_SERVICE_KEY || ''
const REALTIME_BASE = `http://localhost:${process.env.MEEV_REALTIME_PORT || 3003}`

/** Emit `event` to `room` on the realtime service. Silently no-ops when the service is down. */
export async function broadcast(room: string, event: string, payload: unknown): Promise<void> {
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 1500)
    await fetch(`${REALTIME_BASE}/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-meev-service-key': SERVICE_KEY },
      body: JSON.stringify({ room, event, payload }),
      signal: ac.signal,
    })
    clearTimeout(timer)
  } catch {
    // realtime service unavailable — delivery skipped by design
  }
}

/** Create a Notification row + push `notif:new` to the user's personal room. */
export async function notifyUser(
  userId: string,
  kind: string,
  title: string,
  body = '',
  data: Record<string, unknown> = {}
) {
  const n = await db.notification.create({
    data: { id: newId(), userId, kind, title, body, data: JSON.stringify(data) },
  })
  await broadcast(`user:${userId}`, 'notif:new', {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    data,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  })
  return n
}
