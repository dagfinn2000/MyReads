/**
 * The order library cards rise in (`.card-in` in globals.css): one after
 * another from the top, row by row, so no card shows up before the ones
 * above it.
 *
 * Only cards that weren't showing before take part. On the first view that
 * is every card; after "Show more" it is the new ones at the bottom, which
 * start rising straight away instead of waiting behind the cards above them
 * that are already in place; after another tab or filter it is the books
 * that tab adds. Cards already showing keep their place, so a refresh while
 * the cards are still rising doesn't restart them.
 */

/** Cards that rise one after another. The rest of a batch rise together
 *  just after the last of these, so a big library never waits long. */
export const STAGGERED_CARDS = 24;

/**
 * Each card's step in the rise (its `--i`), by key. `keys` lists the cards
 * in reading order: section by section, and within a section in grid order,
 * which runs along each row. A key is a book's id, prefixed by its section's
 * key when the library is grouped, because a book shown in two sections is
 * two cards. `before` is the last result, for the cards that were showing.
 */
export function cascadeSteps(
  keys: readonly string[],
  before: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const steps = new Map<string, number>();
  let next = 0;
  for (const key of keys) {
    if (steps.has(key)) continue;
    const kept = before.get(key);
    if (kept !== undefined) {
      steps.set(key, kept);
    } else {
      steps.set(key, Math.min(next, STAGGERED_CARDS));
      next++;
    }
  }
  return steps;
}
