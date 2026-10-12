import { NextResponse } from "next/server";
import type { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { spendMetadataBudget } from "@/lib/api-guard";
import { getPreferences } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { searchBooks } from "@/lib/metadata";
import { isbnVariants, looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import { escapeLike, foldForSearch } from "@/lib/utils";

/** What the check UI needs to show a hit — no reading data beyond the badge bits. */
const bookSelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  status: true,
  rating: true,
  timesRead: true,
  format: true,
  ownership: true,
} as const;

export interface LibraryCheckResult {
  /** "isbn" = this exact edition; "title" = same title, different edition. */
  match: "isbn" | "title" | null;
  book?: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    status: ReadingStatus;
    rating: number | null;
    timesRead: number;
    format: BookFormat;
    ownership: BookOwnership;
  };
  /** What the ISBN resolved to in the metadata sources (scan flow only). */
  lookedUp?: { title: string; authors: string[] } | null;
  /** The catalogues couldn't be asked, so only the exact edition was checked. */
  lookupFailed?: boolean;
}

/**
 * GET /api/library/check?isbn=…[&title=…&author=…] — "do I own this?"
 *
 * Matching, most to least specific:
 *  1. ISBN, in both its 10- and 13-digit forms — the exact edition.
 *  2. Title (+ first author when known) against the library's searchText —
 *     catches "you own this, but as a different edition/translation".
 *     The scan flow has no title, so the ISBN is looked up in the metadata
 *     sources first; the add flow passes title/author straight through.
 *     That lookup spends from the caller's metadata budget (lib/api-guard.ts).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const isbnParam = searchParams.get("isbn")?.trim() ?? "";
  const titleParam = searchParams.get("title")?.trim() ?? "";
  const authorParam = searchParams.get("author")?.trim() ?? "";
  if (!isbnParam && !titleParam) {
    return NextResponse.json({ error: "isbn or title required" }, { status: 400 });
  }
  // The scan flow has only the ISBN to go on; junk there would be answered
  // "not in your library", which reads as a real answer.
  if (!titleParam && !looksLikeIsbn(isbnParam)) {
    return NextResponse.json({ error: "That doesn't look like an ISBN" }, { status: 400 });
  }

  if (isbnParam) {
    const book = await prisma.book.findFirst({
      where: { userId, isbn: { in: isbnVariants(isbnParam) } },
      select: bookSelect,
    });
    if (book) {
      return NextResponse.json({ match: "isbn", book } satisfies LibraryCheckResult);
    }
  }

  let title = titleParam;
  let author = authorParam;
  let lookedUp: LibraryCheckResult["lookedUp"] = null;
  let lookupFailed = false;
  if (!title && isbnParam) {
    // This is the one branch that calls out to the external catalogues, so
    // it spends from the same per-user budget as /api/metadata/*.
    const limited = spendMetadataBudget(userId);
    if (limited) return limited;
    // The reader's catalogues, in their order (Preferences).
    const { catalogues } = await getPreferences();
    try {
      const results = await searchBooks(normalizeIsbn(isbnParam), catalogues);
      const hit = results[0];
      if (hit) {
        title = hit.title;
        author = hit.authors[0] ?? "";
        lookedUp = { title: hit.title, authors: hit.authors };
      }
    } catch {
      // Metadata sources down. The ISBN check above already ran; say that
      // the title check couldn't.
      lookupFailed = true;
    }
  }

  if (title) {
    // Both conditions substring-match searchText (title + authors + series).
    // Requiring the author's surname too keeps short titles from matching
    // half the library.
    // Folded like searchText, so an edition titled "Brontë" still matches
    // a catalogue that spells it "Bronte".
    const surname = author.split(/\s+/).filter(Boolean).pop();
    const book = await prisma.book.findFirst({
      where: {
        userId,
        AND: [
          { searchText: { contains: escapeLike(foldForSearch(title)) } },
          ...(surname ? [{ searchText: { contains: escapeLike(foldForSearch(surname)) } }] : []),
        ],
      },
      select: bookSelect,
    });
    if (book) {
      return NextResponse.json({
        match: "title",
        book,
        lookedUp,
      } satisfies LibraryCheckResult);
    }
  }

  return NextResponse.json({
    match: null,
    lookedUp,
    ...(lookupFailed && { lookupFailed }),
  } satisfies LibraryCheckResult);
}
