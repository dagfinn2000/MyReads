import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { coverFilePath } from "@/lib/covers";
import { parsePreferences } from "@/lib/preferences";

/**
 * GET /api/export — downloads the signed-in user's entire library as a zip:
 * `library.json` (every book with its shelf names, quotes, read history,
 * reading log and lending records, every shelf, reading goals, saved views,
 * and the account's theme, library view and preferences) plus
 * `covers/<file>` for each
 * locally cached cover image, so a restore into a fresh instance brings the
 * covers back too.
 *
 * The JSON inside is still the version-1 export format — quotes, reads,
 * progress, loans, settings, saved views and pages goals are additive
 * fields (as are a goal's `countRereads`, a book's `lengthMinutes` and a
 * past read's `note`), and `owned` is still written
 * alongside the newer `ownership` — so unzipping and feeding `library.json`
 * to an older instance keeps working.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [books, shelves, readingGoals, user, savedViews] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        shelves: { select: { name: true } },
        quotes: {
          select: { text: true, page: true, note: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        reads: {
          select: {
            dateStarted: true,
            dateFinished: true,
            rating: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        progress: {
          select: { page: true, date: true },
          orderBy: [{ date: "asc" }, { page: "asc" }],
        },
        loans: {
          select: {
            borrower: true,
            lentAt: true,
            returnedAt: true,
            note: true,
            createdAt: true,
          },
          orderBy: { lentAt: "asc" },
        },
      },
    }),
    prisma.shelf.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { name: true, createdAt: true },
    }),
    prisma.readingGoal.findMany({
      where: { userId },
      orderBy: { year: "asc" },
      select: { year: true, target: true, unit: true, countRereads: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { theme: true, libraryView: true, preferences: true },
    }),
    prisma.savedView.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, query: true },
    }),
  ]);

  const payload = {
    format: "myreads-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    username: session.user.name ?? null,
    counts: { books: books.length, shelves: shelves.length },
    shelves,
    // Pages goals get a list of their own: an older MyReads reads every
    // entry of readingGoals as a number of books.
    readingGoals: readingGoals
      .filter((g) => g.unit === "BOOKS")
      .map(({ unit: _unit, ...goal }) => goal),
    pageGoals: readingGoals
      .filter((g) => g.unit === "PAGES")
      .map(({ unit: _unit, ...goal }) => goal),
    // The account's own settings: theme, library view and Preferences. A
    // restore fills these in only where the account has none yet. The
    // default saved view is kept by name, since ids don't survive a move.
    settings: {
      theme: user?.theme ?? null,
      libraryView: user?.libraryView ?? null,
      preferences: user?.preferences ?? null,
      defaultViewName:
        savedViews.find((v) => v.id === parsePreferences(user?.preferences).defaultViewId)
          ?.name ?? null,
    },
    savedViews: savedViews.map(({ name, query }) => ({ name, query })),
    books: books.map(({ userId: _userId, searchText: _searchText, ...book }) => ({
      ...book,
      // `owned` no longer exists on the row, but the export format promises
      // that an older instance can still read this file. Emitting the boolean
      // alongside the richer field keeps that promise: an old build sees the
      // shelf/wishlist split it understands, a current one prefers
      // `ownership`. A borrowed or given-away book reads as "not owned"
      // there, which is the closest true statement that vocabulary has.
      owned: book.ownership === "OWNED",
      shelves: book.shelves.map((s) => s.name),
    })),
  };

  const zip = new JSZip();
  zip.file("library.json", JSON.stringify(payload, null, 2));

  // Bundle every locally cached cover. A missing file is not an error — the
  // book row simply exports without its image, exactly as before. Files are
  // read concurrently but added to the zip in book order, so the archive
  // layout stays deterministic.
  const coverFiles = await Promise.all(
    books
      .filter((b) => b.coverUrl?.startsWith("/api/covers/"))
      .map(async (book) => {
        const filename = path.basename(book.coverUrl!);
        try {
          return { filename, buf: await fs.readFile(coverFilePath(filename)) };
        } catch {
          return null; // cover cache miss — skip
        }
      }),
  );
  for (const file of coverFiles) {
    if (!file) continue;
    // Covers are already-compressed images; deflating again wastes CPU.
    zip.file(`covers/${file.filename}`, file.buf, { compression: "STORE" });
  }

  // Streamed rather than assembled in memory: generateAsync would hold the
  // entire archive — every cover image plus the JSON — as one buffer before
  // the first byte reaches the client, which on a large library is the
  // difference between a download and an out-of-memory kill on a small VPS.
  const zipStream = zip.generateInternalStream({
    type: "uint8array",
    compression: "DEFLATE",
  });

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      zipStream
        .on("data", (chunk: Uint8Array) => controller.enqueue(chunk))
        .on("error", (err: Error) => controller.error(err))
        .on("end", () => controller.close());
      zipStream.resume();
    },
    cancel() {
      // Client went away mid-download — stop generating.
      zipStream.pause();
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="myreads-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
