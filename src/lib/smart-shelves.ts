import { BookFormat, ReadingStatus } from "@/lib/enums";
import { FORMAT_LABELS } from "@/lib/display";
import { activeFilterChips, parseFilters } from "@/lib/library-filters";
import { canonicalViewQueryFromString } from "@/lib/saved-views";
import { statusName, type StatusPrefs } from "@/lib/statuses";

/**
 * Smart shelves: shelves that fill themselves. A smart shelf keeps library
 * filters as its rules ("Want to Read, tagged sci-fi, up to 300 pages"),
 * and every book that matches them is on it, now and later. It sits among
 * the reader's shelves (the chip row, Manage shelves, Group by shelf, a
 * book's Shelves card, challenges) and opens like one: `?shelfId=` with
 * its id narrows whatever tab and filters are on screen to its books
 * (library-where.ts resolveBookWhere).
 *
 * Saved views are the other way to keep filters: a view brings back the
 * whole library address, sort and grouping too, as a chip of its own.
 */

/** Most smart shelves one account keeps. Each is counted on every visit
 *  to the library, so the cap keeps that to a handful of small queries. */
export const MAX_SMART_SHELVES = 30;

/** Parameters of a library address that say how it's laid out, not which
 *  books it holds. */
const LAYOUT = ["group", "sort", "dir"];

/**
 * A library address's filters as a smart shelf keeps them: canonical (the
 * same filters always the same text, only parameters the library knows),
 * without the sort and grouping. "" when nothing is filtered.
 */
export function smartRulesQuery(query: string): string {
  const params = new URLSearchParams(canonicalViewQueryFromString(query));
  for (const key of LAYOUT) params.delete(key);
  return params.toString();
}

/** The shelf a smart shelf's rules keep to, if any. */
export function rulesShelfId(rules: string): string {
  return new URLSearchParams(rules).get("shelfId") ?? "";
}

/** How the ownership filter reads as a rule. */
const OWNED_RULES: Record<string, string> = {
  owned: "Owned",
  wishlist: "On the wishlist",
  borrowed: "Borrowed",
  given_away: "No longer have it",
  lent: "Lent out",
  overdue: "Overdue",
};

/**
 * A smart shelf's rules in words, one entry a rule, in the order the
 * library's controls run: status, shelf, search, format, ownership, then
 * the chips under the filter bar ("Tag: sci-fi", "Up to 300 pages").
 */
export function describeRules(
  rules: string,
  o: {
    statuses: Pick<StatusPrefs, "statusNames" | "customStatuses">;
    /** The reader's own shelves by id. */
    shelfNames: ReadonlyMap<string, string>;
    ratingLabel: (minRating: string) => string;
    fieldLabel?: (field: string) => string | null;
    fmt?: (n: number) => string;
  },
): string[] {
  const f = parseFilters(Object.fromEntries(new URLSearchParams(rules)));
  const out: string[] = [];
  const status = Object.values(ReadingStatus).find((s) => s === f.shelf);
  if (status) {
    const custom = f.statusKey
      ? o.statuses.customStatuses.find((c) => c.key === f.statusKey && c.base === status)
      : undefined;
    out.push(custom?.name ?? statusName(status, o.statuses));
  }
  if (f.shelfId) {
    const name = o.shelfNames.get(f.shelfId);
    out.push(name ? `On “${name}”` : "On a shelf since deleted");
  }
  if (f.q) out.push(`Matching “${f.q}”`);
  const format = Object.values(BookFormat).find((x) => x === f.format);
  if (format) out.push(FORMAT_LABELS[format]);
  if (Object.hasOwn(OWNED_RULES, f.owned)) out.push(OWNED_RULES[f.owned]);
  for (const chip of activeFilterChips(f, o.ratingLabel, o.fieldLabel, o.fmt)) {
    out.push(chip.label);
  }
  return out;
}
