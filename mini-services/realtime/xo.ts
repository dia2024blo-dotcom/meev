// MEEV realtime service — in-DM Tic-Tac-Toe ("XO") mini-game.
// Games live in memory keyed by dm conversationId. Starter plays 'x', partner
// 'o'. Win/draw award XP via /api/internal/xp (game_win 8 / game_play 2).

import type { Server, Socket } from 'socket.io'
import { partnerIn } from './chat'
import { isOnline } from './presence'
import { awardXp } from './internal'
import { log } from './util'
import type { MiniUser } from './types'

export interface XOGame {
  conversationId: string
  board: (string | null)[]
  turn: 'x' | 'o'
  status: 'active' | 'finished' | 'abandoned'
  winner: 'x' | 'o' | 'draw' | null
  players: { x: string; o: string }
  startedAt: number
}

const games = new Map<string, XOGame>()

const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function broadcastState(io: Server, game: XOGame): void {
  io.to(`dm:${game.conversationId}`).emit('dm:game:state', {
    conversationId: game.conversationId,
    game: {
      board: game.board,
      turn: game.turn,
      status: game.status,
      winner: game.winner,
      players: game.players,
    },
  })
}

function gameError(socket: Socket, conversationId: string, error: string): void {
  socket.emit('game:error', { conversationId, error })
}

// ------------------------- dm:game:start -------------------------

export function handleStart(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null
  if (!conversationId) return

  const partnerId = partnerIn(conversationId, user.id)
  if (!partnerId || !isOnline(partnerId)) {
    gameError(socket, conversationId, 'Partner is offline right now')
    return
  }

  const game: XOGame = {
    conversationId,
    board: Array<string | null>(9).fill(null),
    turn: 'x',
    status: 'active',
    winner: null,
    players: { x: user.id, o: partnerId },
    startedAt: Date.now(),
  }
  games.set(conversationId, game)
  broadcastState(io, game)
  log(`xo: game started in dm ${conversationId} (${user.id} as x vs ${partnerId} as o)`)
}

// ------------------------- dm:game:move -------------------------

export function handleMove(io: Server, socket: Socket, user: MiniUser, payload: any): void {
  const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null
  if (!conversationId) return
  const game = games.get(conversationId)
  if (!game) {
    gameError(socket, conversationId, 'No active game')
    return
  }
  if (game.status !== 'active') {
    gameError(socket, conversationId, 'Game is already over')
    return
  }
  const cell = payload?.cell
  if (!Number.isInteger(cell) || (cell as number) < 0 || (cell as number) > 8) {
    gameError(socket, conversationId, 'Invalid cell')
    return
  }
  if (game.players[game.turn] !== user.id) {
    gameError(socket, conversationId, 'Not your turn')
    return
  }
  if (game.board[cell] !== null) {
    gameError(socket, conversationId, 'Cell already taken')
    return
  }

  game.board[cell] = game.turn

  const win = LINES.some(
    ([a, b, c]) =>
      game.board[a] !== null && game.board[a] === game.board[b] && game.board[a] === game.board[c],
  )
  if (win) {
    game.status = 'finished'
    game.winner = game.turn
    broadcastState(io, game)
    const winnerId = game.players[game.turn]
    const loserId = game.turn === 'x' ? game.players.o : game.players.x
    awardXp(winnerId, 8, 'game_win')
    awardXp(loserId, 2, 'game_play')
    log(`xo: dm ${conversationId} finished — ${game.turn} (${winnerId}) wins`)
    return
  }
  if (game.board.every((c) => c !== null)) {
    game.status = 'finished'
    game.winner = 'draw'
    broadcastState(io, game)
    awardXp(game.players.x, 2, 'game_play')
    awardXp(game.players.o, 2, 'game_play')
    log(`xo: dm ${conversationId} finished — draw`)
    return
  }

  game.turn = game.turn === 'x' ? 'o' : 'x'
  broadcastState(io, game)
}

// ------------------------- dm:game:leave -------------------------

export function handleLeave(io: Server, user: MiniUser, payload: any): void {
  const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null
  if (!conversationId) return
  const game = games.get(conversationId)
  if (!game) return
  game.status = 'abandoned'
  broadcastState(io, game)
  games.delete(conversationId)
  log(`xo: game abandoned in dm ${conversationId} by ${user.username}`)
}

// ------------------------- disconnect cleanup -------------------------

/** Called when a user's last socket goes offline — abandon their games. */
export function onUserOffline(io: Server, userId: string): void {
  for (const [conversationId, game] of games) {
    if (game.players.x !== userId && game.players.o !== userId) continue
    if (game.status === 'active') {
      game.status = 'abandoned'
      broadcastState(io, game)
    }
    games.delete(conversationId)
  }
}

export function stats(): { active: number } {
  let active = 0
  for (const g of games.values()) if (g.status === 'active') active++
  return { active }
}
