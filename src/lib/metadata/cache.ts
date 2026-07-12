import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // one week

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
    await prisma.metadataCache.upsert({
      where,
      create: {
        source,
        query: key,
        payload: fresh as Prisma.InputJsonValue,
        expiresAt,
      },
      update: { payload: fresh as Prisma.InputJsonValue, expiresAt },
    });
    return fresh;
  }

  // Stale-if-error fallback.
  return hit ? (hit.payload as T) : null;
}
