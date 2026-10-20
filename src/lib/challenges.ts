import { describePace, type GoalPace } from "@/lib/goals";
import { canonicalViewQueryFromString } from "@/lib/saved-views";
import type { Counted, CountBook } from "@/lib/stats-count";

/**
 * Challenges: a goal for a slice of the library, such as "6 classics in
 * 2026". The slice is a library address's filters (a tag, a shelf, or a
 * saved view's), and a book counts once it's finished in the year.
 */

export const CHALLENGE_NAME_MAX = 60;
export const MAX_CHALLENGES = 50;
export const CHALLENGE_TARGET_MAX = 1000;

/** Filters that make no sense for "finished in the year": the status tab
 *  (a finished book is Read), the year itself, and how the list is laid
 *  out. */
const DROPPED = ["shelf", "finished", "group", "sort", "dir"];

/** A library query string as a challenge stores it: only the filters that
 *  pick books, canonical, so the same slice is always the same text. */
export function challengeQuery(query: string): string {
  const params = new URLSearchParams(canonicalViewQueryFromString(query));
  for (const key of DROPPED) params.delete(key);
  return params.toString();
}

/** Where the challenge's books are in the library: its slice, finished in
 *  its year. */
export function challengeHref(query: string, year: number): string {
  const params = new URLSearchParams(query);
  params.set("finished", String(year));
  return `/books?${params.toString()}`;
}

/** What a challenge can be made from, as the form's menu offers it. The
 *  value is what the create action receives. */
export interface ChallengeSource {
  value: string;
  label: string;
  /** The name a challenge gets when none is typed. */
  name: string;
}

export function challengeSources(o: {
  tags: string[];
  shelves: { id: string; name: string }[];
  views: { id: string; name: string }[];
}): { group: string; sources: ChallengeSource[] }[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return [
    {
      group: "Saved views",
      sources: o.views.map((v) => ({ value: `view:${v.id}`, label: v.name, name: v.name })),
    },
    {
      group: "Shelves",
      sources: o.shelves.map((s) => ({ value: `shelf:${s.id}`, label: s.name, name: s.name })),
    },
    {
      group: "Tags",
      sources: o.tags.map((t) => ({ value: `tag:${t}`, label: t, name: cap(t) })),
    },
  ].filter((g) => g.sources.length > 0);
}

/**
 * The books that count toward a challenge: those matching its slice with a
 * finish in the year, each once, in the order they were finished.
 */
export function challengeBooks<B extends CountBook>(
  yearItems: Counted<B>[],
  matching: ReadonlySet<string>,
): B[] {
  const seen = new Map<string, { book: B; day: string }>();
  for (const i of yearItems) {
    if (i.books === 0 || !matching.has(i.pass.book.id)) continue;
    const day = i.pass.day ?? "";
    const prev = seen.get(i.pass.book.id);
    if (!prev || day < prev.day) seen.set(i.pass.book.id, { book: i.pass.book, day });
  }
  return [...seen.values()]
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    .map((e) => e.book);
}

/** How a challenge is going, as a sentence: the goal card's pace, in a
 *  challenge's words. */
export function challengePaceText(
  pace: GoalPace,
  fmt: (n: number) => string = String,
  startsOn = "1 January",
): string {
  if (pace.kind === "reached") {
    return pace.over > 0
      ? `Done, with ${fmt(pace.over)} more than you planned.`
      : "Done.";
  }
  return describePace(pace, "BOOKS", fmt, startsOn);
}
