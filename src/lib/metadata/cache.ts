import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // one week

/** Longer lookups skip the cache. Postgres can't index a key much past 2 KB
 *  (it refuses the row), and a refused cache write failed the lookup it was
 *  only meant to remember. Real titles and ISBNs are far shorter. */
const MAX_KEY_LENGTH = 500;

/**
 * Read-through cache for external metadata lookups, backed by the
 * MetadataCache table.
 *
 * - Fresh cache hit → returned without touching the network.
 * - Miss/stale → `fetcher` runs; a non-null result is upserted.
 * - `fetcher` fails but a stale row exists → the stale payload is returned,
 *   so a flaky Open Library never breaks lookups that worked before.
 */
export async function cachedLookup<T>(
  source: string,
  query: string,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  const key = query.trim().toLowerCase();
  if (key.length > MAX_KEY_LENGTH) return fetcher().catch(() => null);
  const where = { source_query: { source, query: key } };

  const hit = await prisma.metadataCache.findUnique({ where });
  if (hit && hit.expiresAt > new Date()) {
    return hit.payload as T;
  }

  let fresh: T | null = null;
  try {
    fresh = await fetcher();
  } catch {
    fresh = null;
  }

  if (fresh !== null) {
    const expiresAt = new Date(Date.now() + TTL_MS);
    // Best effort: the answer is good whether or not it could be kept.
    await prisma.metadataCache
      .upsert({
        where,
        create: {
          source,
          query: key,
          payload: fresh as Prisma.InputJsonValue,
          expiresAt,
        },
        update: { payload: fresh as Prisma.InputJsonValue, expiresAt },
      })
      .catch(() => {});
    return fresh;
  }

  // Stale-if-error fallback.
  return hit ? (hit.payload as T) : null;
}
