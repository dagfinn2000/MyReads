/**
 * The library's view preference — which sort/direction/grouping the user
 * last chose. Saved on the User row (User.libraryView) whenever it changes
 * in the filter bar, and applied by the books page when the URL carries no
 * explicit view params, so clicking away and back doesn't reset the view.
 *
 * The value lists here are the source of truth shared by the filter bar's
 * dropdowns, the save action's validation, and the books page's fallback —
 * add new sorts/groupings here first.
 */

export const LIBRARY_SORTS = [
  "createdAt",
  "title",
  "author",
  "rating",
  "dateFinished",
] as const;

export const LIBRARY_GROUPS = ["none", "author", "series"] as const;

export const LIBRARY_DIRS = ["asc", "desc"] as const;

// A type alias (not an interface) so it satisfies Prisma's Json input type —
// aliases get an implicit index signature for assignability, interfaces don't.
export type LibraryView = {
  sort: (typeof LIBRARY_SORTS)[number];
  dir: (typeof LIBRARY_DIRS)[number];
  group: (typeof LIBRARY_GROUPS)[number];
};

export const DEFAULT_LIBRARY_VIEW: LibraryView = {
  sort: "createdAt",
  dir: "desc",
  group: "none",
};

/** Stored JSON (or anything else) → a safe view, unknown fields defaulted. */
export function parseLibraryView(raw: unknown): LibraryView {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends readonly string[]>(
    allowed: T,
    value: unknown,
    fallback: T[number],
  ): T[number] =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T[number])
      : fallback;
  return {
    sort: pick(LIBRARY_SORTS, obj.sort, DEFAULT_LIBRARY_VIEW.sort),
    dir: pick(LIBRARY_DIRS, obj.dir, DEFAULT_LIBRARY_VIEW.dir),
    group: pick(LIBRARY_GROUPS, obj.group, DEFAULT_LIBRARY_VIEW.group),
  };
}
