import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";

/**
 * Per-account preferences — everything on the Account page's Preferences
 * card. Stored as one JSON value on User.preferences and read back through
 * parsePreferences, which fills in a default for anything missing or
 * invalid. That makes adding a setting a change to this file only: old rows
 * simply don't have the new key yet and get its default.
 *
 * The value lists here are the source of truth for the Preferences form's
 * options and for the save action's validation.
 */

export const DATE_FORMATS = [
  "d-mmm-y", // 12 May 2024
  "mmm-d-y", // May 12, 2024
  "dd.mm.y", // 12.05.2024
  "dd/mm/y", // 12/05/2024
  "mm/dd/y", // 05/12/2024
  "iso", // 2024-05-12
] as const;

export const NUMBER_FORMATS = [
  "comma", // 1,234
  "space", // 1 234
  "period", // 1.234
] as const;

export const WEEK_STARTS = ["monday", "sunday"] as const;

/** Alphabets the library can sort by. Each is a locale for Intl.Collator,
 *  which decides where letters like Æ, Ø, Å, Ä and Ö go. */
export const SORT_ALPHABETS = ["en", "nb", "da", "sv", "de"] as const;

export const AUTHOR_ORDERS = ["surname", "as-written"] as const;

/** Book catalogues, as named in lib/metadata/index.ts. */
export const CATALOGUES = ["openlibrary", "google", "nb"] as const;

export const RATING_STYLES = ["half", "whole", "ten", "off"] as const;

export const TEXT_SIZES = ["normal", "large", "larger"] as const;

export const LONG_TEXT_FONTS = ["sans", "serif"] as const;

/** The face for page titles, book titles and card titles: the app's own
 *  sans (Geist), a book serif (Literata) or a rounded sans (Nunito). */
export const HEADING_FONTS = ["sans", "serif", "rounded"] as const;

/** Animations on or off. Off is also forced whenever the device asks for
 *  reduced motion, whatever this says (see globals.css and lib/motion.ts). */
export const MOTIONS = ["on", "off"] as const;

/** What a book without a cover image shows: a drawn cover with its title,
 *  or the plain grey box. */
export const COVER_ARTS = ["drawn", "plain"] as const;

/** Accent colours that can replace a theme's own: buttons, links, focus
 *  rings and progress bars. "theme" keeps the theme's accent. Each has a
 *  deeper shade for light themes and a lighter one for dark themes
 *  (globals.css). */
export const ACCENTS = [
  "theme",
  "rose",
  "orange",
  "amber",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "violet",
  "fuchsia",
] as const;

/** How round corners are, through the --radius token every radius in the
 *  app derives from. */
export const CORNERS = ["square", "rounded", "round"] as const;

/** A texture behind the pages (globals.css draws each one). */
export const BACKGROUNDS = [
  "plain",
  "grain",
  "dots",
  "lines",
  "grid",
  "linen",
  "books",
  "waves",
  "glow",
] as const;

/** Colour steps for the reading calendar (see lib/heatmap.ts). */
export const HEATMAP_SCALES = ["standard", "gentle", "heavy", "auto"] as const;

export const START_PAGES = ["library", "stats", "add"] as const;

/** Top-bar links that can be hidden. The rest are always shown. */
export const HIDEABLE_NAV = ["check", "quotes"] as const;

/** Cards on the stats page that can be hidden. */
export const HIDEABLE_STATS = [
  "goal",
  "heatmap",
  "perYear",
  "tags",
  "formats",
  "quote",
] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];
export type NumberFormat = (typeof NUMBER_FORMATS)[number];
export type WeekStart = (typeof WEEK_STARTS)[number];
export type SortAlphabet = (typeof SORT_ALPHABETS)[number];
export type AuthorOrder = (typeof AUTHOR_ORDERS)[number];
export type Catalogue = (typeof CATALOGUES)[number];
export type RatingStyle = (typeof RATING_STYLES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type LongTextFont = (typeof LONG_TEXT_FONTS)[number];
export type HeadingFont = (typeof HEADING_FONTS)[number];
export type Motion = (typeof MOTIONS)[number];
export type CoverArtStyle = (typeof COVER_ARTS)[number];
export type Accent = (typeof ACCENTS)[number];
export type Corners = (typeof CORNERS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type HeatmapScale = (typeof HEATMAP_SCALES)[number];
export type StartPage = (typeof START_PAGES)[number];
export type HideableNav = (typeof HIDEABLE_NAV)[number];
export type HideableStat = (typeof HIDEABLE_STATS)[number];

// A type alias (not an interface) so it satisfies Prisma's Json input type,
// same as LibraryView.
export type Preferences = {
  // New books
  newBookFormat: BookFormat;
  newBookStatus: ReadingStatus;
  newBookOwnership: BookOwnership;
  /** Copy the subjects a catalogue returns into the tags field. */
  importTags: boolean;

  // Dates and numbers
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  weekStart: WeekStart;
  /** IANA zone ("Europe/Oslo"). Empty = not chosen yet, which means the
   *  server's zone; the app fills it in from the browser on first visit. */
  timeZone: string;

  // Sorting
  /** Sort "The Hobbit" under H. */
  ignoreArticles: boolean;
  authorOrder: AuthorOrder;
  sortAlphabet: SortAlphabet;

  /** Catalogues to search, in priority order. Ones left out are off. */
  catalogues: Catalogue[];

  ratingStyle: RatingStyle;

  textSize: TextSize;
  longTextFont: LongTextFont;
  headingFont: HeadingFont;

  // Appearance
  motion: Motion;
  coverArt: CoverArtStyle;
  accent: Accent;
  corners: Corners;
  background: Background;

  heatmapScale: HeatmapScale;
  startPage: StartPage;
  hiddenNav: HideableNav[];
  hiddenStats: HideableStat[];
  /** SavedView id the library opens on. Empty = the plain library. */
  defaultViewId: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  newBookFormat: BookFormat.PHYSICAL,
  newBookStatus: ReadingStatus.WANT_TO_READ,
  newBookOwnership: BookOwnership.OWNED,
  importTags: true,
  dateFormat: "d-mmm-y",
  numberFormat: "comma",
  weekStart: "monday",
  timeZone: "",
  ignoreArticles: false,
  authorOrder: "surname",
  sortAlphabet: "en",
  catalogues: ["openlibrary", "google", "nb"],
  ratingStyle: "half",
  textSize: "normal",
  longTextFont: "sans",
  headingFont: "sans",
  motion: "on",
  coverArt: "drawn",
  accent: "theme",
  corners: "rounded",
  background: "plain",
  heatmapScale: "standard",
  startPage: "library",
  hiddenNav: [],
  hiddenStats: [],
  defaultViewId: "",
};

/** True for a time zone this runtime knows ("Europe/Oslo", "UTC"). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function pick<T extends readonly string[]>(
  allowed: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

/** Known values only, each once, in the order given. */
function pickList<T extends readonly string[]>(allowed: T, value: unknown): T[number][] {
  if (!Array.isArray(value)) return [];
  const out: T[number][] = [];
  for (const v of value) {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v) && !out.includes(v)) {
      out.push(v as T[number]);
    }
  }
  return out;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Stored JSON (or anything else) → a complete, safe Preferences. */
export function parsePreferences(raw: unknown): Preferences {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;

  const catalogues = Array.isArray(obj.catalogues)
    ? pickList(CATALOGUES, obj.catalogues)
    : d.catalogues;

  return {
    newBookFormat: pick(Object.values(BookFormat), obj.newBookFormat, d.newBookFormat),
    newBookStatus: pick(Object.values(ReadingStatus), obj.newBookStatus, d.newBookStatus),
    newBookOwnership: pick(
      Object.values(BookOwnership),
      obj.newBookOwnership,
      d.newBookOwnership,
    ),
    importTags: bool(obj.importTags, d.importTags),
    dateFormat: pick(DATE_FORMATS, obj.dateFormat, d.dateFormat),
    numberFormat: pick(NUMBER_FORMATS, obj.numberFormat, d.numberFormat),
    weekStart: pick(WEEK_STARTS, obj.weekStart, d.weekStart),
    timeZone:
      typeof obj.timeZone === "string" && isValidTimeZone(obj.timeZone)
        ? obj.timeZone
        : d.timeZone,
    ignoreArticles: bool(obj.ignoreArticles, d.ignoreArticles),
    authorOrder: pick(AUTHOR_ORDERS, obj.authorOrder, d.authorOrder),
    sortAlphabet: pick(SORT_ALPHABETS, obj.sortAlphabet, d.sortAlphabet),
    // Searching nothing at all is never what anyone means, so an empty list
    // goes back to the default.
    catalogues: catalogues.length > 0 ? catalogues : d.catalogues,
    ratingStyle: pick(RATING_STYLES, obj.ratingStyle, d.ratingStyle),
    textSize: pick(TEXT_SIZES, obj.textSize, d.textSize),
    longTextFont: pick(LONG_TEXT_FONTS, obj.longTextFont, d.longTextFont),
    headingFont: pick(HEADING_FONTS, obj.headingFont, d.headingFont),
    motion: pick(MOTIONS, obj.motion, d.motion),
    coverArt: pick(COVER_ARTS, obj.coverArt, d.coverArt),
    accent: pick(ACCENTS, obj.accent, d.accent),
    corners: pick(CORNERS, obj.corners, d.corners),
    background: pick(BACKGROUNDS, obj.background, d.background),
    heatmapScale: pick(HEATMAP_SCALES, obj.heatmapScale, d.heatmapScale),
    startPage: pick(START_PAGES, obj.startPage, d.startPage),
    hiddenNav: pickList(HIDEABLE_NAV, obj.hiddenNav),
    hiddenStats: pickList(HIDEABLE_STATS, obj.hiddenStats),
    defaultViewId:
      typeof obj.defaultViewId === "string" && obj.defaultViewId.length <= 64
        ? obj.defaultViewId
        : d.defaultViewId,
  };
}

/** Where each start page lives. */
export const START_PAGE_PATHS: Record<StartPage, string> = {
  library: "/books",
  stats: "/stats",
  add: "/books/new",
};

/** The zone this server runs in — what reading days used to be counted in,
 *  and still are until the reader's own zone is known. */
export function serverTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** The fields of `patch` that are real preferences, each made valid the same
 *  way parsePreferences would. Unknown keys are dropped, so a save can only
 *  ever write keys this file knows about. */
export function cleanPreferencesPatch(patch: unknown): Partial<Preferences> {
  if (!patch || typeof patch !== "object") return {};
  const keys = Object.keys(patch).filter((k) => k in DEFAULT_PREFERENCES) as (keyof Preferences)[];
  const parsed = parsePreferences({ ...DEFAULT_PREFERENCES, ...patch });
  const out: Partial<Preferences> = {};
  for (const k of keys) (out as Record<string, unknown>)[k] = parsed[k];
  return out;
}
