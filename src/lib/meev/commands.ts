// MEEV — Chat slash-command processing (/roll /8ball /poll /shrug /help
// /flip /hug /kiss /pat /boop /rps /gift). Used by
// POST /api/internal/messages before persistence.
// This module is intentionally DB-free so the client composer can import
// parseCommand for its own interception (/gift opens the gift dialog).

const EIGHT_BALL_ANSWERS = [
  'It is certain 🐾',
  'Without a doubt',
  'Yes, definitely',
  'Signs point to yes',
  'Reply hazy, try again',
  'Ask again later…',
  'Better not tell you now',
  'My sources say no',
  'Very doubtful',
  'The cat says meh 🐱',
]

export type CommandResult = {
  kind: 'text' | 'system' | 'poll' | 'sticker' | 'game'
  content: string
  meta?: Record<string, unknown>
}

/** Split a raw message into command name (no slash, lowercase) + argument. Client-safe. */
export function parseCommand(raw: string): { name: string; arg: string } {
  const content = (raw || '').trim()
  const spaceIdx = content.indexOf(' ')
  const cmd = spaceIdx === -1 ? content : content.slice(0, spaceIdx)
  const arg = spaceIdx === -1 ? '' : content.slice(spaceIdx + 1).trim()
  return { name: cmd.slice(1).toLowerCase(), arg }
}

/** Big-reaction commands: giant emoji sticker + a warm caption. */
const REACTIONS: Record<string, { emoji: string; line: (a: string, b: string) => string }> = {
  hug: { emoji: '🤗', line: (a, b) => `${a} hugged ${b} tightly 🤗` },
  kiss: { emoji: '😘', line: (a, b) => `${a} kissed ${b} 😘` },
  pat: { emoji: '🐾', line: (a, b) => `${a} patted ${b}'s head 🐾` },
  boop: { emoji: '🫳', line: (a, b) => `${a} booped ${b}'s nose 🫳` },
}

/**
 * Synchronous command processing. Partner-aware commands (/hug /kiss /pat
 * /boop) personalize their caption with `partnerName` when the context is a
 * DM (resolved by the caller in createMessage). /rps is NOT handled here —
 * it needs DB access for duel resolution and lives in messages.ts.
 */
export function processCommand(raw: string, displayName: string, partnerName?: string | null): CommandResult {
  const { name, arg } = parseCommand(raw)
  const who = partnerName || 'everyone'

  switch (name) {
    case 'roll': {
      const roll = 1 + Math.floor(Math.random() * 6)
      return { kind: 'system', content: `🎲 ${displayName} rolled **${roll}**` }
    }
    case '8ball': {
      if (!arg) return { kind: 'system', content: '🔮 Usage: /8ball your question' }
      const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)]
      return { kind: 'system', content: `🔮 ${answer}` }
    }
    case 'poll': {
      const parts = arg
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length < 3) {
        return { kind: 'system', content: 'Usage: /poll Question | Option 1 | Option 2 (up to 4 options)' }
      }
      const question = parts[0]
      const options = parts.slice(1, 5)
      return { kind: 'poll', content: question, meta: { question, options } }
    }
    case 'shrug': {
      return { kind: 'text', content: `${arg ? arg + ' ' : ''}¯\\_(ツ)_/¯` }
    }
    case 'flip': {
      const cats = Math.random() < 0.5
      return {
        kind: 'system',
        content: cats
          ? `🪙 ${displayName} flipped Gold Meev — CATS! 🐱`
          : `🪙 ${displayName} flipped Gold Meev — TAILS!`,
      }
    }
    case 'hug':
    case 'kiss':
    case 'pat':
    case 'boop': {
      const r = REACTIONS[name]
      return {
        kind: 'sticker',
        content: r.line(displayName, who),
        meta: { stickerEmoji: r.emoji },
      }
    }
    case 'rps': {
      // handled asynchronously in messages.ts (duel state + DB); this is
      // only reached when called without conversation context.
      return { kind: 'system', content: '⚔️ Usage: /rps rock | paper | scissors — challenge your DM partner to a duel!' }
    }
    case 'help': {
      return {
        kind: 'system',
        content:
          'Commands: /roll — roll a die · /8ball question — magic 8-ball · /poll Question | Opt 1 | Opt 2 — create a poll · /shrug — appends ¯\\_(ツ)_/¯ · /flip — flip a Gold Meev 🪙 · /hug /kiss /pat /boop — send a big reaction · /rps rock|paper|scissors — RPS duel ⚔️ (+8 XP) · /gift name — pick a gift 🎁 · /help — this list',
      }
    }
    default: {
      return { kind: 'system', content: `Unknown command /${name}. Try /help` }
    }
  }
}
