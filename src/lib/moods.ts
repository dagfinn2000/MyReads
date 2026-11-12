import { STATUS_COLORS, type StatusColor } from "@/lib/statuses";

/**
 * Reading moods: how a book feels ("cosy", "dark", "funny"), as opposed to
 * what it's about, which is what tags are for. A book has any number of
 * them (Book.moods, a list of keys), set on its page; the library filters
 * and groups by them, bulk edit adds and takes them off, and Stats counts
 * them.
 *
 * There are BUILT_IN_MOODS, each with its own icon and tint, and up to
 * MAX_CUSTOM_MOODS of the reader's own (Preferences › Moods), each with an
 * icon and tint picked from the same sets. A built-in mood can be hidden:
 * it's no longer offered, but a book that has it still shows it. An own
 * mood removed is taken off its books (forgetLostMoods); any other key a
 * book still carries is ignored wherever moods are shown.
 */

/** The icons a mood can have: lucide's, by their kebab-case names
 *  (components/mood-icon.tsx draws them). The built-in moods' come first. */
export const MOOD_ICONS = [
  "coffee",
  "laugh",
  "feather",
  "heart",
  "sunrise",
  "wand-sparkles",
  "sparkles",
  "compass",
  "lightbulb",
  "graduation-cap",
  "mountain",
  "drama",
  "cloud-rain",
  "key-round",
  "zap",
  "ghost",
  "moon",
  "smile",
  "sun",
  "flame",
  "snowflake",
  "leaf",
  "flower",
  "tree-pine",
  "waves",
  "wind",
  "umbrella",
  "music",
  "party-popper",
  "cookie",
  "star",
  "gem",
  "crown",
  "castle",
  "swords",
  "rocket",
  "telescope",
  "anchor",
  "bird",
  "cat",
  "puzzle",
  "brain",
  "eye",
  "glasses",
  "hourglass",
  "skull",
] as const;
export type MoodIcon = (typeof MOOD_ICONS)[number];

/** A mood's tint: one of the status colours (lib/statuses.ts). */
export type MoodColor = StatusColor;

// A type alias (not an interface), so a list of them is a Prisma Json
// value, as Preferences are.
export type Mood = {
  /** Stable id, kept on books. A built-in mood's is its English name. */
  key: string;
  name: string;
  icon: MoodIcon;
  color: MoodColor;
};

/** The reader's own moods: the same shape, with a key made when added. */
export type CustomMood = Mood;

/**
 * The built-in moods, from light to dark: the order every list of moods
 * follows. Neighbours are tinted apart, so a row of a book's moods never
 * runs two of one colour together where it can help it.
 */
export const BUILT_IN_MOODS: readonly Mood[] = [
  { key: "cosy", name: "Cosy", icon: "coffee", color: "amber" },
  { key: "funny", name: "Funny", icon: "laugh", color: "orange" },
  { key: "lighthearted", name: "Light-hearted", icon: "feather", color: "lime" },
  { key: "romantic", name: "Romantic", icon: "heart", color: "pink" },
  { key: "hopeful", name: "Hopeful", icon: "sunrise", color: "sky" },
  { key: "whimsical", name: "Whimsical", icon: "wand-sparkles", color: "violet" },
  { key: "inspiring", name: "Inspiring", icon: "sparkles", color: "amber" },
  { key: "adventurous", name: "Adventurous", icon: "compass", color: "teal" },
  { key: "thoughtful", name: "Thoughtful", icon: "lightbulb", color: "indigo" },
  { key: "informative", name: "Informative", icon: "graduation-cap", color: "slate" },
  { key: "challenging", name: "Challenging", icon: "mountain", color: "orange" },
  { key: "emotional", name: "Emotional", icon: "drama", color: "rose" },
  { key: "sad", name: "Sad", icon: "cloud-rain", color: "sky" },
  { key: "mysterious", name: "Mysterious", icon: "key-round", color: "violet" },
  { key: "tense", name: "Tense", icon: "zap", color: "rose" },
  { key: "spooky", name: "Spooky", icon: "ghost", color: "lime" },
  { key: "dark", name: "Dark", icon: "moon", color: "indigo" },
];

const BUILT_IN_KEYS = new Set(BUILT_IN_MOODS.map((m) => m.key));

export const MAX_CUSTOM_MOODS = 16;
export const MOOD_NAME_MAX = 24;

/** What reading moods needs from Preferences. */
export type MoodPrefs = { hiddenMoods: string[]; customMoods: CustomMood[] };

const KEY = /^[a-z0-9]{1,16}$/;

/** True for a string that could be a mood's key. */
export function isMoodKey(value: unknown): value is string {
  return typeof value === "string" && KEY.test(value);
}

export function isBuiltInMood(key: string): boolean {
  return BUILT_IN_KEYS.has(key);
}

/** A name as stored: trimmed, inner runs of space made one, no control
 *  characters; null when empty or too long. */
export function cleanMoodName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return name && name.length <= MOOD_NAME_MAX ? name : null;
}

const isIcon = (v: unknown): v is MoodIcon =>
  typeof v === "string" && (MOOD_ICONS as readonly string[]).includes(v);
const isColor = (v: unknown): v is MoodColor =>
  typeof v === "string" && (STATUS_COLORS as readonly string[]).includes(v);

/** Built-in keys, each once. */
export function parseHiddenMoods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const key of value) if (typeof key === "string" && BUILT_IN_KEYS.has(key)) out.add(key);
  return [...out];
}

/** The reader's own moods: each key once and never a built-in one, each
 *  name once (ignoring case), at most MAX_CUSTOM_MOODS. An unknown icon or
 *  tint falls back rather than costing the mood. */
export function parseCustomMoods(value: unknown): CustomMood[] {
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>();
  const names = new Set<string>();
  const out: CustomMood[] = [];
  for (const item of value) {
    if (out.length >= MAX_CUSTOM_MOODS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { key, name: rawName, icon, color } = item as Record<string, unknown>;
    const name = cleanMoodName(rawName);
    if (!isMoodKey(key) || BUILT_IN_KEYS.has(key) || keys.has(key) || !name) continue;
    if (names.has(name.toLowerCase())) continue;
    keys.add(key);
    names.add(name.toLowerCase());
    out.push({
      key,
      name,
      icon: isIcon(icon) ? icon : "smile",
      color: isColor(color) ? color : "slate",
    });
  }
  return out;
}

/** Every mood there is for this reader, hidden ones too: the built-in
 *  ones, then their own. What a book's keys are looked up in. */
export function allMoods(prefs: Pick<MoodPrefs, "customMoods">): Mood[] {
  return [...BUILT_IN_MOODS, ...prefs.customMoods];
}

/** The moods offered for a book and in the library's filter: all but the
 *  hidden built-in ones. */
export function offeredMoods(prefs: MoodPrefs): Mood[] {
  const hidden = new Set(prefs.hiddenMoods);
  return allMoods(prefs).filter((m) => !hidden.has(m.key));
}

/** A book's moods as the reader knows them, in list order. Keys that name
 *  no mood are left out. */
export function bookMoods(keys: readonly string[], prefs: Pick<MoodPrefs, "customMoods">): Mood[] {
  const have = new Set(keys);
  return allMoods(prefs).filter((m) => have.has(m.key));
}

/** A mood by its key, or null. */
export function moodOf(key: string, prefs: Pick<MoodPrefs, "customMoods">): Mood | null {
  return allMoods(prefs).find((m) => m.key === key) ?? null;
}

/**
 * Moods as a book stores them: strings naming a mood the reader has
 * (hidden built-in ones too: a book can keep one), each once, in list
 * order. Anything else is dropped.
 */
export function cleanBookMoods(value: unknown, prefs: Pick<MoodPrefs, "customMoods">): string[] {
  if (!Array.isArray(value)) return [];
  const have = new Set(value.filter((v): v is string => typeof v === "string"));
  return allMoods(prefs)
    .filter((m) => have.has(m.key))
    .map((m) => m.key);
}

/** Most moods one filter list keeps. */
export const MAX_FILTER_MOODS = 50;

/** A comma-joined list of mood keys from a URL: things that could be keys,
 *  each once. Whether the reader has them is for the page to say. */
export function moodList(s: string): string[] {
  const out = new Set<string>();
  for (const raw of s.split(",")) {
    const key = raw.trim();
    if (!isMoodKey(key)) continue;
    out.add(key);
    if (out.size >= MAX_FILTER_MOODS) break;
  }
  return [...out];
}

/** Each tint as a mood chip (light and dark), written out in full so
 *  Tailwind finds every class. Same tints as statuses, a step softer. */
export const MOOD_CHIP: Record<MoodColor, string> = {
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-800/70 dark:text-slate-200",
  sky: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  indigo: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  violet: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  pink: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
  rose: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  orange: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  lime: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
  teal: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
};

/** The icon's own colour, a little stronger than the chip's text. */
export const MOOD_ICON_TINT: Record<MoodColor, string> = {
  slate: "text-slate-500 dark:text-slate-400",
  sky: "text-sky-600 dark:text-sky-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  violet: "text-violet-600 dark:text-violet-400",
  pink: "text-pink-600 dark:text-pink-400",
  rose: "text-rose-600 dark:text-rose-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  lime: "text-lime-600 dark:text-lime-400",
  teal: "text-teal-600 dark:text-teal-400",
};

/** The tint as a bar (Stats). */
export const MOOD_BAR: Record<MoodColor, string> = {
  slate: "bg-slate-400 dark:bg-slate-500",
  sky: "bg-sky-400 dark:bg-sky-500",
  indigo: "bg-indigo-400 dark:bg-indigo-500",
  violet: "bg-violet-400 dark:bg-violet-500",
  pink: "bg-pink-400 dark:bg-pink-500",
  rose: "bg-rose-400 dark:bg-rose-500",
  orange: "bg-orange-400 dark:bg-orange-500",
  amber: "bg-amber-400 dark:bg-amber-500",
  lime: "bg-lime-400 dark:bg-lime-500",
  teal: "bg-teal-400 dark:bg-teal-500",
};

/** The library address of the books with one mood. */
export function moodHref(key: string): string {
  return `/books?mood=${encodeURIComponent(key)}`;
}
