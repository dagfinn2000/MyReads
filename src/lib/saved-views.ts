import { parseFilters, tagList } from "@/lib/library-filters";
import { naturalDir, parseLibraryView } from "@/lib/library-view";

/** Most saved views one account can keep. Chips above the library stop
 *  being useful long before this; it only stops a runaway client. */
export const MAX_SAVED_VIEWS = 50;

export const SAVED_VIEW_NAME_MAX = 40;

type Params = Record<string, string | string[] | undefined>;

/**
 * A library address's filters, sort and grouping as one canonical query
 * string — the form a saved view is stored in, and what a page compares
 * against to know which saved view (if any) is on screen.
 *
 * Built from the parsed values, so only parameters the library understands
 * are kept (no `limit`, nothing made up), always in the same order, with
 * the defaults left out exactly as the filter bar leaves them out. Tag lists
 * are sorted, so the same tags picked in another order are the same view.
 */
export function canonicalViewQuery(sp: Params): string {
  const f = parseFilters(sp);
  const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const view = parseLibraryView({ sort: first(sp.sort), dir: first(sp.dir), group: first(sp.group) });
  // A sort without a direction opens the way the library would open it.
  const dir = !first(sp.dir) && first(sp.sort) ? naturalDir(view.sort) : view.dir;
  const sorted = (list: string) => tagList(list).sort().join(",");

  const params = new URLSearchParams();
  if (f.shelf && f.shelf !== "all") params.set("shelf", f.shelf);
  if (f.shelfId) params.set("shelfId", f.shelfId);
  if (f.q) params.set("q", f.q);
  if (f.author) params.set("author", f.author);
  if (f.tag) params.set("tag", sorted(f.tag));
  if (f.tag && f.tagMatch === "all") params.set("tagMatch", "all");
  if (f.notTag) params.set("notTag", sorted(f.notTag));
  if (f.format && f.format !== "all") params.set("format", f.format);
  if (f.owned && f.owned !== "all") params.set("owned", f.owned);
  if (f.minRating && f.minRating !== "all") params.set("minRating", f.minRating);
  if (f.finished) params.set("finished", f.finished);
  if (f.missing) params.set("missing", f.missing);
  if (f.series) params.set("series", f.series);
  params.set("group", view.group);
  params.set("sort", view.sort);
  params.set("dir", dir);
  return params.toString();
}

/** The same, from a query string — what the save action receives. */
export function canonicalViewQueryFromString(query: string): string {
  return canonicalViewQuery(Object.fromEntries(new URLSearchParams(query)));
}
