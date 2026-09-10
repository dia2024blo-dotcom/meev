// MEEV realtime service — presence tracking.
// `online: Map<userId, MiniUser>` + `socketIds: Map<userId, Set<socketId>>`.
// Broadcasts presence:update / presence:online-users and pushes presence
// changes to the monolith's /api/internal/presence (fire-and-forget).

import type { Server, Socket } from 'socket.io'
import { ONLINE_LIST_CAP } from './config'
import { pushPresence } from './internal'
import { log } from './util'
import type { MiniUser } from './types'

const online = new Map<string, MiniUser>()
const socketIds = new Map<string, Set<string>>()

export function onlineCount(): number {
  return online.size
}

export function getMini(userId: string): MiniUser | null {
  return online.get(userId) ?? null
}

/** Fresh mini, or the (possibly stale) fallback passed in. */
export function miniOr(fallback: MiniUser): MiniUser {
  return online.get(fallback.id) ?? fallback
}

export function isOnline(userId: string): boolean {
  return online.has(userId)
}

export function onlineUsers(cap = ONLINE_LIST_CAP): MiniUser[] {
  return Array.from(online.values()).slice(0, cap)
}

export function broadcastOnlineUsers(io: Server): void {
  io.emit('presence:online-users', { users: onlineUsers() })
}

/**
 * Register an authenticated socket. Returns true when the user transitioned
 * offline → online (first live socket) — only then do we broadcast.
 */
export function userConnected(io: Server, user: MiniUser, socket: Socket): boolean {
  let ids = socketIds.get(user.id)
  if (!ids) {
    ids = new Set()
    socketIds.set(user.id, ids)
  }
  ids.add(socket.id)

  const existing = online.get(user.id)
  if (!existing) {
    online.set(user.id, { ...user, presence: 'online' })
    io.emit('presence:update', { userId: user.id, presence: 'online' })
    broadcastOnlineUsers(io)
    pushPresence(user.id, 'online')
    return true
  }
  // user already online (another tab) — refresh profile fields, keep presence
  online.set(user.id, { ...user, presence: existing.presence })
  return false
}

/**
 * Deregister a socket. Returns true when the user's LAST socket left and they
 * went offline — only then do we broadcast.
 */
export function userDisconnected(io: Server, userId: string, socketId: string): boolean {
  const ids = socketIds.get(userId)
  if (!ids) return false
  ids.delete(socketId)
  if (ids.size > 0) return false

  socketIds.delete(userId)
  if (!online.has(userId)) return false
  online.delete(userId)
  io.emit('presence:update', { userId, presence: 'offline' })
  broadcastOnlineUsers(io)
  pushPresence(userId, 'offline')
  return true
}

/** presence:set {status: online|busy|dnd} → update + broadcast + internal push. */
export function setPresence(io: Server, userId: string, status: unknown): boolean {
  if (typeof status !== 'string') return false
  if (status !== 'online' && status !== 'busy' && status !== 'dnd') return false
  const mini = online.get(userId)
  if (!mini) return false
  mini.presence = status
  online.set(userId, mini)
  io.emit('presence:update', { userId, presence: status })
  pushPresence(userId, status)
  return true
}
