// MEEV — Input sanitization & hardening layer.
// Every text input passes through here before touching the database
// (spec §2.4): XSS-stripping, length caps, control-char removal.

// Field length caps (v3 hardening pass). Every cap is a ceiling — routes may
// pass a stricter maxOverride (e.g. stories keep the legacy 280 story limit).
const MAX_FIELD: Record<string, number> = {
  content: 2000,
  message: 2000,
  comment: 1000,
  post: 2000,
  bio: 500,
  displayName: 40,
  username: 24,
  note: 30, // v13: user spec — a note is one tiny sentence
  title: 120,
  subject: 120,
  details: 1000,
}

/** Escapes HTML entities — used when rendering user text anywhere unsafe. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strips tags/scripts and control characters, clamps length. */
export function sanitizeText(input: unknown, field = 'content', maxOverride?: number): string {
  if (typeof input !== 'string') return ''
  const max = maxOverride ?? MAX_FIELD[field] ?? 2000
  let text = input
    // remove null/control chars
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // neutralize script/style blocks and tags entirely
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
  if (text.length > max) text = text.slice(0, max)
  return text.trim()
}

/** Detects obviously suspicious payloads worth logging (security audit). */
export function looksSuspicious(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return /(<script|javascript:|union\s+select|drop\s+table|xp_cmdshell|\{\{\s*\$|<[i]?frame)/i.test(input)
}

/** Username rules: 3-24 chars, a-z 0-9 _ . only. */
export function sanitizeUsername(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)
}

export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '').slice(0, 120)
}

/** Whitelist helper (anti mass-assignment): keeps only allowed keys. */
export function pickAllowed<T extends object>(body: T, allowed: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k]
  }
  return out
}
