import { ReadingStatus } from "@prisma/client";

/**
 * The reader's own order for shelf chips and saved views, kept in
 * Preferences as lists of ids (shelfOrder, savedViewOrder). The lists may
 * name shelves or views deleted since, and may leave out ones made since;
 * these helpers take both in their stride.
 */

/**
 * `items` with the ones named in `order` first, in that order, then the
 * rest in the order they came in (by name, from the query), so a new shelf
 * joins the end of the row. Unknown and repeated ids in `order` are
 * ignored; every item comes back exactly once.
 */
export function orderByIds<T extends { id: string }>(items: T[], order: readonly string[]): T[] {
  if (order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const listed: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    seen.add(id);
    listed.push(item);
  }
  return [...listed, ...items.filter((item) => !seen.has(item.id))];
}

/** `ids` with `id` swapped with its neighbour above (-1) or below (1).
 *  Unchanged at either end, or when `id` isn't in the list. */
export function moveId(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const next = [...ids];
  const i = next.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * The status tabs the library shows, in their usual order: every status
 * but the hidden ones. The tab on screen (`current`, from ?shelf=) always
 * stays, so a bookmark to a hidden tab still shows where you are. Hiding
 * them all reads as hiding none, as it does in Preferences.
 */
export function statusTabsToShow(
  hidden: readonly ReadingStatus[],
  current: string,
): ReadingStatus[] {
  const all = Object.values(ReadingStatus);
  const shown = all.filter((s) => !hidden.includes(s) || s === current);
  return shown.length > 0 ? shown : all;
}
