// ============================================================
// MEEV realtime service — smoke test client (run manually, never auto-run).
//
//   cd mini-services/realtime && bun test-client.ts
//
// Uses raw WebSocket + the engine.io v4 text protocol (no extra deps):
//   open '0{...}' → send '40' (namespace connect) → '40{...}' ack
//   events are '42["<event>",<payload>]' frames, pings '2' → pong '3'.
// Exercises: /health, /broadcast (401 + ok), hello (valid + bogus token),
// presence:set, dm:send (expects msg:error on a fake conversation),
// dm:game:start (expects game:error), match:queue → AI fallback after 10s,
// match:send → match:typing + match:new (bot reply), match:end → match:summary.
// ============================================================

import { SERVICE_KEY } from './config'
import { signAccessToken } from './auth'

const BASE = 'http://localhost:3003'
const TOKEN = signAccessToken('u_smoke_test_1', 'smoketestcat', 600)

const PAD = '  '

function parseEvent(data: string): [string, any] | null {
  if (!data.startsWith('42')) return null
  try {
    const arr = JSON.parse(data.slice(2))
    if (Array.isArray(arr) && typeof arr[0] === 'string') return [arr[0], arr[1]]
  } catch {
    /* ignore */
  }
  return null
}

async function checkHttp(): Promise<void> {
  console.log('\n== HTTP endpoints ==')
  const health = await fetch(`${BASE}/health`).then((r) => r.json() as Promise<any>)
  console.log(`${PAD}GET /health →`, JSON.stringify(health))

  const noKey = await fetch(`${BASE}/broadcast`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: 'user:none', event: 'x', payload: {} }),
  })
  console.log(`${PAD}POST /broadcast without key → HTTP ${noKey.status} ${JSON.stringify(await noKey.json().catch(() => null))}`)

  const badBody = await fetch(`${BASE}/broadcast`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-meev-service-key': SERVICE_KEY },
    body: 'not-json',
  })
  console.log(`${PAD}POST /broadcast with bad JSON → HTTP ${badBody.status}`)
}

function runSocket(token: string, label: string, interactive: boolean): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n== socket (${label}) ==`)
    let nsConnected = false
    let matchId: string | null = null
    let ended = false
    const ws = new WebSocket(`ws://localhost:3003/?EIO=4&transport=websocket`)

    const finish = () => {
      if (ended) return
      ended = true
      try { ws.close() } catch { /* ignore */ }
      resolve()
    }
    // generous budget: 10s AI fallback + reply delay + fetch timeout headroom
    const budget = setTimeout(finish, interactive ? 32000 : 6000)

    ws.onmessage = (ev: MessageEvent) => {
      const data = String(ev.data)

      if (data === '2') {
        ws.send('3') // engine ping → pong
        return
      }
      if (data.startsWith('0')) {
        console.log(`${PAD}engine open → connecting namespace`)
        ws.send('40')
        return
      }
      if (data.startsWith('44')) {
        console.log(`${PAD}namespace connect ERROR: ${data}`)
        return
      }
      if (data.startsWith('40') && !nsConnected) {
        nsConnected = true
        console.log(`${PAD}namespace connected → sending hello`)
        ws.send(`42${JSON.stringify(['hello', { token }])}`)
        return
      }

      const parsed = parseEvent(data)
      if (!parsed) return
      const [event, payload] = parsed
      console.log(`${PAD}← ${event}`, JSON.stringify(payload).slice(0, 220))

      if (event === 'hello:ok' && interactive) {
        console.log(`${PAD}✓ hello:ok — user=${payload?.user?.username}, online=${payload?.online?.length}`)

        // exercise defensive paths first
        ws.send(`42${JSON.stringify(['presence:set', { status: 'busy' }])}`)
        ws.send(`42${JSON.stringify(['dm:send', { conversationId: 'conv_smoke_fake', content: 'hello there' }])}`)
        ws.send(`42${JSON.stringify(['dm:game:start', { conversationId: 'conv_smoke_fake' }])}`)

        // then matchmaking (AI fallback after 10s alone in queue)
        ws.send(`42${JSON.stringify(['match:queue', { mode: 'text', interests: ['gaming', 'memes'] }])}`)

        // HTTP broadcast to our own user room should arrive on this socket
        void fetch(`${BASE}/broadcast`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-meev-service-key': SERVICE_KEY },
          body: JSON.stringify({
            room: `user:${payload?.user?.id}`,
            event: 'notif:new',
            payload: { kind: 'system', title: 'smoke test ping 🐱' },
          }),
        })
      }

      if (event === 'match:found') {
        matchId = payload?.matchId ?? null
        console.log(`${PAD}✓ match:found — isAI=${payload?.isAI}, partner=${payload?.partner?.displayName}`)
        if (interactive && matchId) {
          ws.send(`42${JSON.stringify(['match:send', { matchId, content: 'hiii <script>alert(1)</script> miau' }])}`)
          setTimeout(() => {
            if (matchId && !ended) {
              ws.send(`42${JSON.stringify(['match:end', { matchId }])}`)
            }
          }, 9000)
        }
      }

      if (event === 'match:new') {
        console.log(`${PAD}✓ match:new — content="${payload?.message?.content}"`)
      }
      if (event === 'match:summary') {
        console.log(`${PAD}✓ match:summary — seconds=${payload?.seconds} isAI=${payload?.isAI}`)
        setTimeout(finish, 800)
      }
    }

    ws.onerror = (e: Event) => {
      console.log(`${PAD}ws error:`, (e as any)?.message ?? e.type)
    }
    ws.onclose = () => {
      console.log(`${PAD}socket closed`)
      clearTimeout(budget)
      resolve()
    }
  })
}

async function main(): Promise<void> {
  console.log('MEEV realtime smoke test — targeting ws://localhost:3003')
  await checkHttp()
  await runSocket(TOKEN, 'valid token', true)
  await runSocket('totally.bogus.token', 'bogus token', false)
  const health = await fetch(`${BASE}/health`).then((r) => r.json() as Promise<any>)
  console.log('\n== final /health ==', JSON.stringify(health))
  console.log('smoke test done')
}

void main()
