// MEEV — Snowflake-style unique IDs (timestamp + worker + sequence)
// Mirrors the Discord-style distributed uniqueness described in the spec.

const EPOCH = 1735689600000 // 2025-01-01 (Meev epoch)
const WORKER = 1n

let sequence = 0n
let lastTs = 0n

function snowflake(): string {
  let now = BigInt(Date.now())
  if (now === lastTs) {
    sequence = (sequence + 1n) & 4095n
    if (sequence === 0n) {
      while (BigInt(Date.now()) <= now) {
        // spin until next millisecond
      }
      now = BigInt(Date.now())
    }
  } else {
    sequence = 0n
  }
  lastTs = now
  const ts = now - BigInt(EPOCH)
  return ((ts << 12n) | (WORKER << 10n) | sequence).toString()
}

export function newId(): string {
  return snowflake()
}

export function idTimestamp(id: string): Date {
  try {
    const n = BigInt(id)
    return new Date(Number(n >> 12n) + EPOCH)
  } catch {
    return new Date()
  }
}
