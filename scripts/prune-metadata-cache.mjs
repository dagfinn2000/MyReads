#!/usr/bin/env node
/**
 * Deletes expired rows from MetadataCache.
 *
 * The cache is read-through with a one-week TTL, but nothing ever removed the
 * stale rows — every distinct search prefix anyone ever typed stayed in the
 * table forever. On a long-lived instance that is the fastest-growing table
 * in the database and none of it is your data.
 *
 * Run from the container entrypoint on every start, and available as
 * `npm run db:prune`. Safe to run at any time: a stale row is only ever a
 * cached third-party lookup, re-fetched on next use.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const { count } = await prisma.metadataCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.log(`[myreads] pruned ${count} expired metadata cache row(s)`);
} catch (err) {
  // Never fail a container start over cache housekeeping.
  console.warn(`[myreads] metadata cache prune skipped: ${err.message}`);
} finally {
  await prisma.$disconnect();
}
