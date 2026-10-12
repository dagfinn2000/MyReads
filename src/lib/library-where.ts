import type { Prisma } from "@prisma/client";
import { buildBookWhere, type LibraryFilters } from "@/lib/library-filters";
import type { Preferences } from "@/lib/preferences";

/**
 * The Prisma `where` for a library view, for every place that has to agree
 * on what "the books on screen" means: the library page, Pick for me and
 * bulk edit's "every matching book". Async because some filters need a
 * query of their own first; this is the one place those run, always scoped
 * to `userId`.
 */
export async function resolveBookWhere(
  userId: string,
  filters: LibraryFilters,
  // Not read yet; the search fields and the reader's zone feed filters that
  // need them.
  _prefs: Pick<Preferences, "searchAlsoIn" | "timeZone">,
): Promise<Prisma.BookWhereInput> {
  return buildBookWhere(userId, filters);
}
