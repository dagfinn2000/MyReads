import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchBooks } from "@/lib/metadata";
import { isbnVariants, normalizeIsbn } from "@/lib/isbn";

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
  owned: true,
} as const;

export interface LibraryCheckResult {
  /** "isbn" = this exact edition; "title" = same title, different edition. */
  match: "isbn" | "title" | null;
  book?: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    status: string;
    rating: number | null;
    timesRead: number;
    format: string;
    owned: boolean;
  };
  /** What the ISBN resolved to in the metadata sources (scan flow only). */
  lookedUp?: { title: string; authors: string[] } | null;
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
  if (!title && isbnParam) {
    try {
      const results = await searchBooks(normalizeIsbn(isbnParam));
      const hit = results[0];
      if (hit) {
        title = hit.title;
        author = hit.authors[0] ?? "";
        lookedUp = { title: hit.title, authors: hit.authors };
      }
    } catch {
      // metadata sources down — the ISBN check above already ran
    }
  }

  if (title) {
    // Both conditions substring-match searchText (title + authors + series).
    // Requiring the author's surname too keeps short titles from matching
    // half the library.
    const surname = author.split(/\s+/).filter(Boolean).pop()?.toLowerCase();
    const book = await prisma.book.findFirst({
      where: {
        userId,
        AND: [
          { searchText: { contains: title.toLowerCase() } },
          ...(surname ? [{ searchText: { contains: surname } }] : []),
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

  return NextResponse.json({ match: null, lookedUp } satisfies LibraryCheckResult);
}
