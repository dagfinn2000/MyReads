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
 *
 * Once the client has read the whole zip, the account's `lastBackupAt` is
 * set, so the Backup card can say when the newest copy was made. A download
 * that fails or is cancelled part-way doesn't count.
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
      select: { id: true, name: true, createdAt: true },
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

  const prefs = parsePreferences(user?.preferences);
  // Preferences that list shelves or saved views by id go out by name too,
  // since ids don't survive a move.
  const shelfNames = new Map(shelves.map((s) => [s.id, s.name]));
  const viewNames = new Map(savedViews.map((v) => [v.id, v.name]));
  const namesOf = (ids: string[], names: Map<string, string>) =>
    ids.flatMap((id) => names.get(id) ?? []);

  const payload = {
    format: "myreads-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    username: session.user.name ?? null,
    counts: { books: books.length, shelves: shelves.length },
    shelves: shelves.map(({ id: _id, ...shelf }) => shelf),
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
    // default saved view, and the shelf and view orders, are kept by name.
    settings: {
      theme: user?.theme ?? null,
      libraryView: user?.libraryView ?? null,
      preferences: user?.preferences ?? null,
      defaultViewName: viewNames.get(prefs.defaultViewId) ?? null,
      shelfOrderNames: namesOf(prefs.shelfOrder, shelfNames),
      hiddenShelfNames: namesOf(prefs.hiddenShelves, shelfNames),
      savedViewOrderNames: namesOf(prefs.savedViewOrder, viewNames),
    },
    // A view kept to one shelf names it too, so a restore can point it at
    // that shelf's new id.
    savedViews: savedViews.map(({ name, query }) => {
      const shelfName = shelfNames.get(new URLSearchParams(query).get("shelfId") ?? "");
      return shelfName ? { name, query, shelfName } : { name, query };
    }),
    books: books.map(({
      userId: _userId,
      searchText: _searchText,
      reviewSearchText: _reviewSearchText,
      ...book
    }) => ({
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

  // Pulled, not pushed: each chunk pauses the zip until the client reads
  // again, so nothing is generated ahead of it. That keeps memory bounded
  // on a slow connection, and it means the end of the zip is only reached
  // once the client has actually read everything before it.
  let cancelled = false;
  let ended = false;
  // The pull waiting on the next chunk, if any. The stream only pulls when
  // a read is waiting and nothing is queued.
  let waiting: (() => void) | null = null;
  const wake = () => {
    const resolve = waiting;
    waiting = null;
    resolve?.();
  };

  // The client has read the last chunk and asked for more: remember when,
  // then end the stream. A failed write mustn't spoil a finished download,
  // and the client may have gone away while it ran, in which case the
  // stream is already closed.
  const finish = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    await prisma.user
      .updateMany({ where: { id: userId }, data: { lastBackupAt: new Date() } })
      .catch(() => {});
    if (cancelled) return;
    try {
      controller.close();
    } catch {
      // already closed
    }
  };

  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        zipStream
          .on("data", (chunk: Uint8Array) => {
            zipStream.pause();
            if (cancelled) return;
            controller.enqueue(chunk);
            wake();
          })
          .on("error", (err: Error) => {
            if (cancelled) return;
            cancelled = true; // a broken zip is no backup
            controller.error(err);
            wake();
          })
          .on("end", () => {
            ended = true;
            if (cancelled || !waiting) return;
            // A read is already waiting on an empty queue, so the client
            // has had every chunk.
            const resolve = waiting;
            waiting = null;
            void finish(controller).finally(resolve);
          });
      },
      pull(controller) {
        if (cancelled) return;
        if (ended) return finish(controller);
        return new Promise<void>((resolve) => {
          waiting = resolve;
          zipStream.resume();
        });
      },
      cancel() {
        // Client went away mid-download — stop generating.
        cancelled = true;
        zipStream.pause();
        wake();
      },
    },
    // Nothing is read ahead of the client.
    { highWaterMark: 0 },
  );

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="myreads-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
