import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { coversDir } from "@/lib/covers";

/**
 * GET /api/export — downloads the signed-in user's entire library as a zip:
 * `library.json` (every book with its shelf names and quotes, every shelf,
 * reading goals) plus `covers/<file>` for each locally cached cover image,
 * so a restore into a fresh instance brings the covers back too.
 *
 * The JSON inside is still the version-1 export format (quotes are an
 * additive field), so unzipping and feeding `library.json` to an older
 * instance keeps working.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [books, shelves, readingGoals] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        shelves: { select: { name: true } },
        quotes: {
          select: { text: true, page: true, note: true, createdAt: true },
          orderBy: { createdAt: "asc" },
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
      select: { year: true, target: true },
    }),
  ]);

  const payload = {
    format: "myreads-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    username: session.user.name ?? null,
    counts: { books: books.length, shelves: shelves.length },
    shelves,
    readingGoals,
    books: books.map(({ userId: _userId, searchText: _searchText, ...book }) => ({
      ...book,
      shelves: book.shelves.map((s) => s.name),
    })),
  };

  const zip = new JSZip();
  zip.file("library.json", JSON.stringify(payload, null, 2));

  // Bundle every locally cached cover. A missing file is not an error — the
  // book row simply exports without its image, exactly as before.
  const dir = coversDir();
  for (const book of books) {
    if (!book.coverUrl?.startsWith("/api/covers/")) continue;
    const filename = path.basename(book.coverUrl);
    try {
      const buf = await fs.readFile(path.join(dir, filename));
      // Covers are already-compressed images; deflating again wastes CPU.
      zip.file(`covers/${filename}`, buf, { compression: "STORE" });
    } catch {
      // cover cache miss — skip
    }
  }

  const body = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  const date = new Date().toISOString().slice(0, 10);
  // Fresh copy pins the TS type to Uint8Array<ArrayBuffer> (BodyInit).
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="myreads-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
