#!/usr/bin/env node
/**
 * Deletes cover files that no book points at.
 *
 * Two ways they accumulate: starting an upload and then abandoning the form
 * (the file is written before the book is saved), and any cover whose row
 * vanished without the cleanup running. Nothing else ever removes them.
 *
 * Deliberately NOT wired into the container entrypoint. This deletes files
 * the app cannot prove are needed, and doing that automatically on every
 * restart is the kind of helpfulness that eventually eats something it
 * shouldn't. Run it when you want to reclaim space:
 *
 *   npm run covers:prune           # report only, deletes nothing
 *   npm run covers:prune -- --yes  # actually delete
 *
 * Files newer than the grace period are always kept, so an upload sitting in
 * a form you haven't submitted yet is never pulled out from under you.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const GRACE_MS = 24 * 60 * 60 * 1000; // 24h
const apply = process.argv.includes("--yes");
const dir = process.env.COVERS_DIR || path.join(process.cwd(), "data", "covers");

const prisma = new PrismaClient();

try {
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    console.log(`[myreads] no cover directory at ${dir} — nothing to do`);
    process.exit(0);
  }

  // Every locally-cached cover currently referenced by a book.
  const rows = await prisma.book.findMany({
    where: { coverUrl: { startsWith: "/api/covers/" } },
    select: { coverUrl: true },
  });
  const referenced = new Set(rows.map((r) => path.basename(r.coverUrl)));

  const now = Date.now();
  let deleted = 0;
  let bytes = 0;
  let keptYoung = 0;

  for (const name of files) {
    if (referenced.has(name)) continue;

    const full = path.join(dir, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    if (now - stat.mtimeMs < GRACE_MS) {
      keptYoung++;
      continue;
    }

    bytes += stat.size;
    deleted++;
    if (apply) {
      await fs.unlink(full).catch(() => {});
    }
  }

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(
    apply
      ? `[myreads] deleted ${deleted} orphaned cover(s), freed ${mb} MB`
      : `[myreads] ${deleted} orphaned cover(s) totalling ${mb} MB — re-run with --yes to delete`,
  );
  if (keptYoung > 0) {
    console.log(`[myreads] kept ${keptYoung} unreferenced file(s) newer than 24h`);
  }
} finally {
  await prisma.$disconnect();
}
