import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Self-heal for `prisma generate` / `prisma db push` running while the dev
 * server is already up: the in-process module cache can predate the newly
 * generated client (missing new models like v2's `supportTicket`). In that
 * case import the regenerated files directly by path — the bundler reads
 * those fresh from disk, bypassing the stale package-level cache.
 */
async function buildClient(): Promise<PrismaClient> {
  // 1) healthy cached singleton → reuse
  const cached = globalForPrisma.prisma
  if (cached && 'supportTicket' in (cached as unknown as Record<string, unknown>)) {
    return cached
  }

  // 2) fresh class from the package export
  try {
    const candidate = new PrismaClient({ log: ['query'] })
    if ('supportTicket' in (candidate as unknown as Record<string, unknown>)) {
      return candidate
    }
    void candidate.$disconnect().catch(() => {})
  } catch {
    /* fall through to the on-disk generated client */
  }

  // 3) dev-server self-heal: load the regenerated client files directly
  try {
    // cast through unknown: the on-disk generated client's exact type shape
    // drifts from the package export after `prisma generate` self-heal reloads
    const mod = (await import('../../node_modules/.prisma/client/index.js')) as unknown as {
      PrismaClient: new (opts: { log: ('query' | 'info' | 'warn' | 'error')[] }) => PrismaClient
    }
    return new mod.PrismaClient({ log: ['query'] })
  } catch {
    // last resort — whatever the package export gives
    return new PrismaClient({ log: ['query'] })
  }
}

export const db = await buildClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
