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
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const GRACE_MS = 24 * 60 * 60 * 1000; // 24h
const apply = process.argv.includes("--yes");
const dir = process.env.COVERS_DIR || path.join(process.cwd(), "data", "covers");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

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
  const removed = new Set();

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
    removed.add(name);
    if (apply) {
      await fs.unlink(full).catch(() => {});
    }
  }

  // The smaller copies of covers (thumbs/<cover>.<width>.webp, made when a
  // page asks for one) go with their cover: those of covers already gone,
  // or going now.
  let thumbs = [];
  try {
    thumbs = await fs.readdir(path.join(dir, "thumbs"));
  } catch {
    // none made yet
  }
  let thumbsDeleted = 0;
  for (const name of thumbs) {
    const cover = name.replace(/\.\d+\.webp$/, "");
    if (referenced.has(cover)) continue;
    const coverGone =
      removed.has(cover) ||
      !(await fs.stat(path.join(dir, cover)).then(() => true, () => false));
    if (!coverGone) continue;
    const full = path.join(dir, "thumbs", name);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    bytes += stat.size;
    thumbsDeleted++;
    if (apply) {
      await fs.unlink(full).catch(() => {});
    }
  }

  const mb = (bytes / 1024 / 1024).toFixed(1);
  const copies = thumbsDeleted ? ` and ${thumbsDeleted} smaller cop${thumbsDeleted === 1 ? "y" : "ies"}` : "";
  console.log(
    apply
      ? `[myreads] deleted ${deleted} orphaned cover(s)${copies}, freed ${mb} MB`
      : `[myreads] ${deleted} orphaned cover(s)${copies} totalling ${mb} MB — re-run with --yes to delete`,
  );
  if (keptYoung > 0) {
    console.log(`[myreads] kept ${keptYoung} unreferenced file(s) newer than 24h`);
  }
} finally {
  await prisma.$disconnect();
}
