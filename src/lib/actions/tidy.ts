"use server";

import { revalidatePath } from "next/cache";
import { BookFormat } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { takeMetadataBudget } from "@/lib/api-guard";
import { localizeCoverAfterResponse } from "@/lib/cover-localize";
import { getPreferences } from "@/lib/current-user";
import { CataloguesUnreachableError, getBookDetails } from "@/lib/metadata";
import { idSchema } from "@/lib/reading-log-input";
import { MAX_TIDY_SKIPS, isTidyKey } from "@/lib/tidy";
import { isAllowedCoverUrl } from "@/lib/validation";

/**
 * Leave one thing on Tidy up alone ("cover:<id>", "dup:<id>+<id>"): it
 * stops showing there. Appended in the database, so two quick taps keep
 * both; the list keeps its newest MAX_TIDY_SKIPS.
 */
export async function leaveTidyItem(key: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!isTidyKey(key)) return { error: "Invalid input" };
  await prisma.$executeRaw`
    UPDATE "User"
    SET "preferences" = jsonb_set(
      COALESCE("preferences", '{}'::jsonb),
      '{tidySkipped}',
      (
        SELECT COALESCE(jsonb_agg(k ORDER BY n), '[]'::jsonb)
        FROM (
          SELECT k, n FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof("preferences"->'tidySkipped') = 'array'
              THEN "preferences"->'tidySkipped' ELSE '[]'::jsonb END
              || to_jsonb(${key}::text)
          ) WITH ORDINALITY AS t(k, n)
          ORDER BY n DESC
          LIMIT ${MAX_TIDY_SKIPS}
        ) newest
      )
    )
    WHERE "id" = ${userId}`;
  revalidatePath("/books/tidy");
  return {};
}

/** Show everything left alone on Tidy up again. */
export async function bringBackTidyItems(): Promise<void> {
  const userId = await requireUserId();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "preferences" = COALESCE("preferences", '{}'::jsonb) || '{"tidySkipped": []}'::jsonb
    WHERE "id" = ${userId}`;
  revalidatePath("/books/tidy");
}

/** What asking the catalogues about one book came to. */
export type FillResult =
  | { kind: "filled"; cover: boolean; pages: boolean }
  | { kind: "nothing" }
  /** The lookup budget is spent: ask again after the wait. */
  | { kind: "paused"; retryInMs: number }
  | { kind: "error"; message: string };

/** The work, the exact edition and Google Books, as the shelf scan counts. */
const DETAILS_COST = 2;

/**
 * "Fill from the catalogues" on Tidy up: asks about one book with an ISBN
 * or Open Library id (so the very edition, not a guess by title) and fills
 * in its cover and page count where they're missing. Nothing the reader
 * set is replaced. Spends the reader's lookup budget like the add page.
 *
 * Nothing is revalidated: the page calls this once per book and refreshes
 * when the run is done, rather than redrawing after every book.
 */
export async function fillFromCatalogue(bookId: string): Promise<FillResult> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { kind: "error", message: "Book not found" };
  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: { title: true, authors: true, isbn: true, openLibraryId: true, coverUrl: true, pageCount: true, format: true },
  });
  if (!book) return { kind: "error", message: "Book not found" };
  const wantCover = !book.coverUrl;
  const wantPages = book.pageCount == null && book.format !== BookFormat.AUDIOBOOK;
  if ((!wantCover && !wantPages) || (!book.isbn && !book.openLibraryId)) return { kind: "nothing" };

  const budget = takeMetadataBudget(userId, DETAILS_COST);
  if (!budget.ok) return { kind: "paused", retryInMs: budget.retryInMs };

  let details;
  try {
    details = await getBookDetails(
      { openLibraryId: book.openLibraryId, isbn: book.isbn, title: book.title, author: book.authors[0] ?? null },
      (await getPreferences()).catalogues,
    );
  } catch (e) {
    if (e instanceof CataloguesUnreachableError) return { kind: "error", message: "Couldn’t reach the book catalogues." };
    throw e;
  }

  const cover =
    wantCover && details.coverUrl && /^https?:\/\//i.test(details.coverUrl) && isAllowedCoverUrl(details.coverUrl)
      ? details.coverUrl
      : null;
  const pages =
    wantPages && details.pageCount && details.pageCount > 0 && details.pageCount <= 100000
      ? Math.round(details.pageCount)
      : null;
  if (!cover && !pages) return { kind: "nothing" };

  // Each only where it's still missing: a save in another tab wins.
  const coverSet = cover
    ? (await prisma.book.updateMany({ where: { id: id.data, userId, coverUrl: null }, data: { coverUrl: cover } }))
        .count > 0
    : false;
  const pagesSet = pages
    ? (await prisma.book.updateMany({ where: { id: id.data, userId, pageCount: null }, data: { pageCount: pages } }))
        .count > 0
    : false;
  if (coverSet) localizeCoverAfterResponse(id.data, cover);
  if (!coverSet && !pagesSet) return { kind: "nothing" };
  return { kind: "filled", cover: coverSet, pages: pagesSet };
}

/** Called when a run of fills is done, so the library and the page show
 *  what was filled. */
export async function finishFilling(): Promise<void> {
  await requireUserId();
  revalidatePath("/books");
  revalidatePath("/books/tidy");
}
