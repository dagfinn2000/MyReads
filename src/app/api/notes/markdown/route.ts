import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parsePreferences } from "@/lib/preferences";
import { bookStatusName } from "@/lib/statuses";
import {
  bookNotesMarkdown,
  markdownFileName,
  uniqueNames,
  type MarkdownEntry,
} from "@/lib/notes-markdown";

/**
 * GET /api/notes/markdown?book=<id>: one book's notes and quotes as a
 * Markdown file (lib/notes-markdown.ts). Without `book`: a zip with a file
 * for every book that has any, ready to drop into an Obsidian vault.
 */

const bookSelect = {
  id: true,
  title: true,
  authors: true,
  isbn: true,
  seriesName: true,
  seriesNumber: true,
  publishedDate: true,
  pageCount: true,
  status: true,
  statusKey: true,
  rating: true,
  dateStarted: true,
  dateFinished: true,
  tags: true,
  review: true,
  notes: { select: { id: true, text: true, page: true, chapter: true, createdAt: true } },
  quotes: { select: { id: true, text: true, page: true, chapter: true, note: true, createdAt: true } },
} as const;

/** `attachment` with the name as typed (RFC 5987) and a plain fallback. */
function disposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const prefs = parsePreferences(user?.preferences);
  const opts = { ratingStyle: prefs.ratingStyle, timeZone: prefs.timeZone || undefined };

  const bookId = req.nextUrl.searchParams.get("book");
  const books = await prisma.book.findMany({
    where: bookId
      ? { id: bookId.slice(0, 64), userId }
      : { userId, OR: [{ notes: { some: {} } }, { quotes: { some: {} } }] },
    select: bookSelect,
    orderBy: { title: "asc" },
  });
  if (bookId && books.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = books.map((b) => {
    const entries: MarkdownEntry[] = [
      ...b.notes.map((n) => ({ ...n, kind: "note" as const })),
      ...b.quotes.map((q) => ({ ...q, kind: "quote" as const })),
    ];
    const body = bookNotesMarkdown({ ...b, statusName: bookStatusName(b, prefs) }, entries, opts);
    return { name: markdownFileName(b), body };
  });

  if (bookId) {
    return new NextResponse(files[0].body, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": disposition(files[0].name),
        "Cache-Control": "no-store",
      },
    });
  }

  const zip = new JSZip();
  const names = uniqueNames(files.map((f) => f.name));
  files.forEach((f, i) => zip.file(`MyReads notes/${names[i]}`, f.body));
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposition(`myreads-notes-${date}.zip`),
      "Cache-Control": "no-store",
    },
  });
}
