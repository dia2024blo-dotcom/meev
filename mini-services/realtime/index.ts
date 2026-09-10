// ============================================================
// MEEV realtime mini-service — entry point (port 3003, socket.io path '/')
// Frontend connects with: io("/?XTransformPort=3003", { path: "/" })
// Plain HTTP endpoints on the same server:
//   GET  /health                     → { ok: true, users: <online count> }
//   POST /broadcast (service key)    { room, event, payload } → { ok: true }
// Events implemented (see docs/meev-api-contract.md §REALTIME):
//   hello, presence:set,
//   dm:join/leave/send/typing, server:join/leave/send/typing,
//   match:queue/send/typing/skip/end/report (AI-stranger fallback),
//   dm:game:start/move/leave (in-DM XO)
// ============================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'
import {
  HTTP_BODY_MAX_BYTES,
  PORT,
  SERVICE_KEY,
} from './config'
import { verifyAccessToken } from './auth'
import { fetchMiniUser } from './internal'
import * as presence from './presence'
import * as chat from './chat'
import * as matchmaking from './matchmaking'
import * as xo from './xo'
import { log, logErr } from './util'
import type { MiniUser } from './types'

// ------------------------- http + socket.io servers -------------------------

const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards /?XTransformPort=3003 to this port
  path: '/',
  serveClient: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1_000_000,
})

// engine.io (path '/') intercepts *every* URL via its request listener
// (check = path === req.url.slice(0, path.length)). To keep /health and
// /broadcast working we wrap the engine's listener with our own dispatcher
// that handles those two routes first and delegates everything else.
const engineRequestListeners = httpServer
  .listeners('request')
  .slice(0) as Array<(req: IncomingMessage, res: ServerResponse) => void>
httpServer.removeAllListeners('request')
httpServer.on('request', (req, res) => {
  try {
    const pathname = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, users: presence.onlineCount() })
      return
    }
    if (req.method === 'POST' && pathname === '/broadcast') {
      void handleBroadcast(req, res)
      return
    }
    if (req.method === 'OPTIONS' && (pathname === '/health' || pathname === '/broadcast')) {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-meev-service-key',
      })
      res.end()
      return
    }
    for (const listener of engineRequestListeners) listener.call(httpServer, req, res)
  } catch (err) {
    logErr('http dispatcher', err)
    if (!res.writableEnded) {
      try {
        sendJson(res, 500, { error: 'Internal error' })
      } catch {
        /* ignore */
      }
    }
  }
})

// ------------------------- http helpers -------------------------

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  if (res.writableEnded || res.headersSent) return
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  })
  res.end(JSON.stringify(data))
}

function readJsonBody(req: IncomingMessage): Promise<{ ok: boolean; data: any }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const finish = (result: { ok: boolean; data: any }) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > HTTP_BODY_MAX_BYTES) {
        finish({ ok: false, data: null })
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('error', () => finish({ ok: false, data: null }))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        finish({ ok: true, data: raw ? JSON.parse(raw) : {} })
      } catch {
        finish({ ok: false, data: null })
      }
    })
  })
}

async function handleBroadcast(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.headers['x-meev-service-key'] !== SERVICE_KEY) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }
    const body = await readJsonBody(req)
    if (!body.ok) {
      sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
    const { room, event, payload } = body.data ?? {}
    if (typeof room !== 'string' || !room || room.length > 200) {
      sendJson(res, 400, { error: 'room is required' })
      return
    }
    if (typeof event !== 'string' || !event || event.length > 200) {
      sendJson(res, 400, { error: 'event is required' })
      return
    }
    io.to(room).emit(event, payload === undefined ? null : payload)
    log(`broadcast → room "${room}" event "${event}"`)
    sendJson(res, 200, { ok: true })
  } catch (err) {
    logErr('POST /broadcast', err)
    sendJson(res, 500, { error: 'Internal error' })
  }
}

// ------------------------- socket wiring -------------------------

io.on('connection', (socket) => {
  log(`socket connected: ${socket.id}`)
  let authed = false

  // ---- hello (auth + presence + online users broadcast) ----
  socket.on('hello', async (payload: any) => {
    try {
      if (authed) return // ignore duplicate hellos from the same socket
      const token = payload?.token
      if (typeof token !== 'string' || !token) {
        socket.emit('hello:error', { error: 'Missing token' })
        return
      }
      const jwt = verifyAccessToken(token)
      if (!jwt) {
        // not part of the contract's event list, but lets the client recover
        // immediately instead of waiting for a hello:ok that never comes
        socket.emit('hello:error', { error: 'Invalid or expired token' })
        setTimeout(() => socket.disconnect(true), 500)
        return
      }

      // enrich from the public profile endpoint; fall back to JWT basics
      const profile = await fetchMiniUser(jwt.username)
      const user: MiniUser = profile
        ? { ...profile, id: jwt.sub, username: jwt.username, presence: 'online' }
        : {
            id: jwt.sub,
            username: jwt.username,
            displayName: jwt.username,
            avatarSeed: jwt.username,
            level: 1,
            presence: 'online',
            nameColor: '',
            isBot: false,
          }

      socket.data.userId = user.id
      socket.data.user = user
      socket.join(`user:${user.id}`)
      authed = true

      const wentOnline = presence.userConnected(io, user, socket)
      socket.emit('hello:ok', {
        user: presence.getMini(user.id) ?? user,
        online: presence.onlineUsers(),
      })
      if (wentOnline) {
        log(`user online: ${user.username} (${user.id}) — ${presence.onlineCount()} online`)
      }
    } catch (err) {
      logErr(`hello (${socket.id})`, err)
      socket.emit('msg:error', { error: 'Authentication failed' })
    }
  })

  // ---- authed event registrar (never throws, never crashes the process) ----
  const on = (event: string, handler: (payload: any) => void | Promise<void>): void => {
    socket.on(event, async (payload: any) => {
      try {
        const user = socket.data.user as MiniUser | undefined
        if (!user) {
          log(`event "${event}" from unauthenticated socket ${socket.id} — ignored`)
          return
        }
        await handler(payload)
      } catch (err) {
        logErr(`event "${event}" (${socket.id})`, err)
      }
    })
  }

  on('presence:set', (p) => {
    presence.setPresence(io, socket.data.userId, p?.status)
  })
  on('dm:join', (p) => chat.handleDmJoin(socket, socket.data.userId, p))
  on('dm:leave', (p) => chat.handleDmLeave(socket, p))
  on('dm:send', (p) => chat.handleDmSend(io, socket, socket.data.user, p))
  on('dm:typing', (p) => chat.handleDmTyping(io, socket, socket.data.user, p))
  on('server:join', (p) => chat.handleServerJoin(socket, socket.data.userId, p))
  on('server:leave', (p) => chat.handleServerLeave(socket, p))
  on('server:send', (p) => chat.handleServerSend(io, socket, socket.data.user, p))
  on('server:typing', (p) => chat.handleServerTyping(io, socket, socket.data.user, p))
  on('match:queue', (p) => matchmaking.handleQueue(io, socket.data.user, p))
  on('match:send', (p) => matchmaking.handleSend(io, socket, socket.data.user, p))
  on('match:typing', (p) => matchmaking.handleTyping(io, socket, socket.data.user, p))
  on('match:effect', (p) => matchmaking.handleEffect(io, socket, socket.data.user, p))
  on('match:skip', (p) => matchmaking.handleSkip(io, socket.data.user, p))
  on('match:end', (p) => matchmaking.handleEnd(io, socket.data.user, p))
  on('match:report', (p) => matchmaking.handleReport(io, socket, socket.data.user, p))
  on('dm:game:start', (p) => xo.handleStart(io, socket, socket.data.user, p))
  on('dm:game:move', (p) => xo.handleMove(io, socket, socket.data.user, p))
  on('dm:game:leave', (p) => xo.handleLeave(io, socket.data.user, p))

  socket.on('disconnect', (reason) => {
    try {
      log(`socket disconnected: ${socket.id} (${reason})`)
      const userId = socket.data.userId as string | undefined
      if (!userId) return
      const wentOffline = presence.userDisconnected(io, userId, socket.id)
      if (wentOffline) {
        matchmaking.onUserOffline(io, userId)
        xo.onUserOffline(io, userId)
        log(`user offline: ${userId} — ${presence.onlineCount()} online`)
      }
    } catch (err) {
      logErr('disconnect handler', err)
    }
  })

  socket.on('error', (err) => logErr(`socket error (${socket.id})`, err))
})

// ------------------------- process guards (never crash) -------------------------

process.on('uncaughtException', (err) => {
  logErr('uncaughtException (service keeps running)', err)
})
process.on('unhandledRejection', (err) => {
  logErr('unhandledRejection (service keeps running)', err)
})

process.on('SIGTERM', () => {
  log('SIGTERM — shutting down realtime service')
  io.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
})
process.on('SIGINT', () => {
  log('SIGINT — shutting down realtime service')
  io.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
})

httpServer.on('error', (err) => logErr('http server error', err))

httpServer.listen(PORT, () => {
  log(`meev-realtime listening on port ${PORT} (socket.io path "/")`)
  log(`health:   GET  http://localhost:${PORT}/health`)
  log(`broadcast: POST http://localhost:${PORT}/broadcast (x-meev-service-key)`)
})

export { io }
