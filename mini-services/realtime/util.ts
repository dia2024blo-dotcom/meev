// MEEV realtime service — small utilities: timestamped logging, sanitization,
// id generation, sliding rate limiter.

import crypto from 'node:crypto'
import { MATCH_MESSAGE_MAX_CHARS, MESSAGE_MAX_CHARS } from './config'

export function nowIso(): string {
  return new Date().toISOString()
}

export function log(...args: unknown[]): void {
  console.log(`[${nowIso()}]`, ...args)
}

export function logErr(...args: unknown[]): void {
  console.error(`[${nowIso()}] ERROR`, ...args)
}

/** Random-ish id with a prefix, e.g. "m_a1b2c3…". */
export function randId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * Sanitize content relayed through matchmaking (contract):
 * strip tags + stray angle brackets, clamp to 1000 chars, trim.
 */
export function sanitizeMatchContent(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(/<[^>]*>/g, '') // strip tag-like sequences
    .replace(/[<>]/g, '') // strip any stray angle brackets
    .slice(0, MATCH_MESSAGE_MAX_CHARS)
    .trim()
}

/**
 * Light pre-flight clean for dm/server messages — the internal messages API
 * does the authoritative sanitization; here we just guard payload size.
 */
export function sanitizeChatContent(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(CONTROL_CHARS, '')
    .slice(0, MESSAGE_MAX_CHARS)
    .trim()
}

/** Per-key sliding-window-ish limiter: allows at most one hit per windowMs. */
export class RateLimiter {
  private last = new Map<string, number>()

  /** Returns true (and records the hit) when the action is allowed. */
  allow(key: string, windowMs: number): boolean {
    const now = Date.now()
    const prev = this.last.get(key)
    if (prev !== undefined && now - prev < windowMs) return false
    this.last.set(key, now)
    return true
  }
}
