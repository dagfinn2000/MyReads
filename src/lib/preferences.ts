import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import {
  EXTRAS,
  MOVABLE,
  ROOMS,
  STOWABLE,
  type Extra,
  type Placement,
  type RoomKind,
  type Stowable,
} from "@/lib/room";
import {
  ROOM_CEILINGS,
  ROOM_FABRICS,
  ROOM_FLOORS,
  ROOM_HANGINGS,
  ROOM_PAPERS,
  ROOM_STYLES,
  ROOM_WALLS,
  ROOM_WOODS,
  type RoomCeiling,
  type RoomFabric,
  type RoomFloor,
  type RoomHanging,
  type RoomOwn,
  type RoomPaper,
  type RoomStyle,
  type RoomWalls,
  type RoomWood,
} from "@/lib/room-styles";
import { DEFAULT_AVATAR, parseAvatar, parseSavedLooks, type AvatarLook } from "@/lib/avatar";
import { parseCatCoat, parseDogCoat, parsePet, type CatCoat, type DogCoat, type Pet } from "@/lib/pets";

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

/** How cards sit on the page: a hairline outline (the original look), a
 *  soft shadow, or frosted glass that lets the background show through. */
export const CARD_STYLES = ["flat", "raised", "frosted"] as const;

/** Behind the top of a book's page: a soft wash of its cover's colours, or
 *  nothing. */
export const BOOK_BACKDROPS = ["cover", "plain"] as const;

/** A texture behind the pages (globals.css draws each one). Rain, snow,
 *  stars, aurora and ripples move gently (components/background-scene.tsx);
 *  sky follows the time of day (lib/sky.ts). */
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
  "contours",
  "stars",
  "leaves",
  "scallops",
  "parquet",
  "aurora",
  "trellis",
  "quatrefoil",
  "asanoha",
  "terrazzo",
  "marble",
  "leather",
  "ricepaper",
  "letterpress",
  "rain",
  "ripples",
  "snow",
  "sky",
] as const;

/** Whether the moving backgrounds move, or stay still while the rest of
 *  the app's animations play. */
export const BACKGROUND_MOTIONS = ["moving", "still"] as const;

/** Colour steps for the reading calendar (see lib/heatmap.ts). */
export const HEATMAP_SCALES = ["standard", "gentle", "heavy", "auto"] as const;

export const START_PAGES = ["library", "stats", "add", "reading"] as const;

/** Top-bar links that can be hidden, in top-bar order. The rest are always
 *  shown. */
export const HIDEABLE_NAV = ["reading", "check", "quotes", "room"] as const;

/** Cards on the stats page that can be hidden. */
export const HIDEABLE_STATS = [
  "goal",
  "heatmap",
  "perYear",
  "tags",
  "formats",
  "quote",
] as const;

/** What "Copy subjects from the catalogue as tags" does: nothing, only the
 *  subjects that match a tag already in the library, or every subject. */
export const IMPORT_TAGS_MODES = ["off", "known", "all"] as const;

/** The finish date a book added as Read gets when none is picked. */
export const ADDED_AS_READ_FINISHED = ["today", "undated"] as const;

/** Where the add form goes after saving a book. */
export const AFTER_ADD = ["open", "another", "library"] as const;

/** The two quick-log buttons on a book being read: +10 and +25 pages, +5
 *  and +10 pages, or +5% of the book. */
export const QUICK_LOG_STEPS = ["10-25", "5-10", "5pct"] as const;

/** How progress is entered and shown for an ebook. Positions are still
 *  stored as pages either way (see lib/progress-units.ts). */
export const EBOOK_UNITS = ["page", "percent"] as const;

/** Same for an audiobook, which can also go by time listened. */
export const AUDIOBOOK_UNITS = ["page", "percent", "time"] as const;

/** Where the "pages a day" pace comes from: the whole current read, or only
 *  the last 7 or 14 days. */
export const PACE_FROM = ["read", "7d", "14d"] as const;

/** Cards on a book's page, in their default order. */
export const BOOK_PAGE_CARDS = ["shelves", "reading", "history", "lending", "quotes"] as const;

export const BOOK_PAGE_CARD_LABELS: Record<(typeof BOOK_PAGE_CARDS)[number], string> = {
  shelves: "Shelves",
  reading: "My reading",
  history: "Read history",
  lending: "Lending",
  quotes: "Quotes",
};

/** A long description in full, or its first lines with a More button. */
export const BOOK_DESCRIPTIONS = ["full", "clamp"] as const;

/** The Shelves card on a book: every shelf as a toggle, or only the shelves
 *  the book is on plus an Add button. */
export const SHELVES_CARD_MODES = ["all", "mine"] as const;

/** Extra places the library search looks besides title, author and series. */
export const SEARCH_FIELDS = ["tags", "isbn", "review"] as const;

/** What "pages read" counts on the stats page: whole books when finished,
 *  or the pages logged on the day they were read. */
export const STATS_PAGES_READ = ["finished", "logged"] as const;

/** How a book you stopped reading (DNF) counts: not at all, by the pages
 *  read before stopping, or as a whole book. */
export const STATS_STOPPED_BOOKS = ["none", "pages", "book"] as const;

/** How audiobooks count: fully, as books but not pages, or not at all. */
export const STATS_AUDIOBOOKS = ["full", "books", "out"] as const;

/** The period the stats page opens on. */
export const STATS_PERIODS = ["all", "year", "12m", "30d"] as const;

/** What the Genres & tags and Formats cards count: the whole library, or
 *  only the books read in the chosen period. */
export const STATS_BREAKDOWNS = ["library", "period"] as const;

/** The quotes page's order. */
export const QUOTE_ORDERS = ["newest", "oldest", "book", "shuffle"] as const;

/** A reminder on the account page when the last backup is old. */
export const BACKUP_REMINDERS = ["off", "monthly"] as const;

/** "Find it at" links on a book's page: a name and an https:// address in
 *  which {isbn}, {title} and {author} are filled in. */
export type FindLink = { name: string; url: string };
export const MAX_FIND_LINKS = 6;
export const FIND_LINK_NAME_MAX = 40;
export const FIND_LINK_URL_MAX = 500;
export const FIND_LINK_PLACEHOLDERS = ["isbn", "title", "author"] as const;

/** A tag rule from imported subjects: always rename `from` to `to`. */
export type TagRename = { from: string; to: string };
/** Rules kept per kind; the oldest go first. They ride along with every
 *  page's preferences, so the list stays short. */
export const MAX_TAG_RULES = 100;
/** Same limit as a tag on a book (actions/tags.ts, bulk.ts). */
export const TAG_RULE_MAX = 50;

/** Ids kept in an order or hidden list. Above this, the rest fall back to
 *  their usual order (by name) after the listed ones. */
export const MAX_ORDERED_IDS = 500;

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
export type CardStyle = (typeof CARD_STYLES)[number];
export type BookBackdrop = (typeof BOOK_BACKDROPS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type BackgroundMotion = (typeof BACKGROUND_MOTIONS)[number];
export type HeatmapScale = (typeof HEATMAP_SCALES)[number];
export type StartPage = (typeof START_PAGES)[number];
export type HideableNav = (typeof HIDEABLE_NAV)[number];
export type HideableStat = (typeof HIDEABLE_STATS)[number];
export type ImportTagsMode = (typeof IMPORT_TAGS_MODES)[number];
export type AddedAsReadFinished = (typeof ADDED_AS_READ_FINISHED)[number];
export type AfterAdd = (typeof AFTER_ADD)[number];
export type QuickLogSteps = (typeof QUICK_LOG_STEPS)[number];
export type EbookUnit = (typeof EBOOK_UNITS)[number];
export type AudiobookUnit = (typeof AUDIOBOOK_UNITS)[number];
export type PaceFrom = (typeof PACE_FROM)[number];
export type BookPageCard = (typeof BOOK_PAGE_CARDS)[number];
export type BookDescriptionMode = (typeof BOOK_DESCRIPTIONS)[number];
export type ShelvesCardMode = (typeof SHELVES_CARD_MODES)[number];
export type SearchField = (typeof SEARCH_FIELDS)[number];
export type StatsPagesRead = (typeof STATS_PAGES_READ)[number];
export type StatsStoppedBooks = (typeof STATS_STOPPED_BOOKS)[number];
export type StatsAudiobooks = (typeof STATS_AUDIOBOOKS)[number];
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export type StatsBreakdown = (typeof STATS_BREAKDOWNS)[number];
export type QuoteOrder = (typeof QUOTE_ORDERS)[number];
export type BackupReminder = (typeof BACKUP_REMINDERS)[number];

// A type alias (not an interface) so it satisfies Prisma's Json input type,
// same as LibraryView.
export type Preferences = {
  // New books
  newBookFormat: BookFormat;
  newBookStatus: ReadingStatus;
  newBookOwnership: BookOwnership;
  /** Copy the subjects a catalogue returns into the tags field: none, only
   *  ones already used as tags, or all. Replaces the old importTags boolean,
   *  which parsePreferences still reads. */
  importTagsMode: ImportTagsMode;
  /** Imported subjects renamed on the way in ("science fiction" → "sci-fi"). */
  tagRenames: TagRename[];
  /** Imported subjects never copied as tags. */
  tagSkips: string[];
  addedAsReadFinished: AddedAsReadFinished;
  afterAdd: AfterAdd;

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
  cardStyle: CardStyle;
  background: Background;
  backgroundMotion: BackgroundMotion;
  bookBackdrop: BookBackdrop;

  heatmapScale: HeatmapScale;
  startPage: StartPage;
  hiddenNav: HideableNav[];
  hiddenStats: HideableStat[];
  /** SavedView id the library opens on. Empty = the plain library. */
  defaultViewId: string;

  // Pick for me
  /** Pick for me skips wishlist and given-away books (borrowed ones count). */
  pickOnlyHave: boolean;
  /** Pick for me skips a Want to Read book while an earlier book in its
   *  series is unread. */
  pickNextInSeries: boolean;

  // Reading
  quickLogSteps: QuickLogSteps;
  ebookUnit: EbookUnit;
  audiobookUnit: AudiobookUnit;
  paceFrom: PaceFrom;

  // Book page
  /** Every card, in the order shown. Always a full list (see parse). */
  bookPageCards: BookPageCard[];
  hiddenBookPageCards: BookPageCard[];
  bookDescription: BookDescriptionMode;
  shelvesCard: ShelvesCardMode;
  findLinks: FindLink[];

  // Library
  searchAlsoIn: SearchField[];
  /** Shelf ids in the order their chips show. Shelves not listed follow,
   *  by name. */
  shelfOrder: string[];
  /** Shelf ids left out of the library's chips. */
  hiddenShelves: string[];
  /** SavedView ids in the order their chips show. */
  savedViewOrder: string[];
  /** Status tabs left out of the library. Never all four. */
  hiddenStatusTabs: ReadingStatus[];

  // Stats
  statsPagesRead: StatsPagesRead;
  statsStoppedBooks: StatsStoppedBooks;
  statsAudiobooks: StatsAudiobooks;
  statsPeriod: StatsPeriod;
  statsBreakdown: StatsBreakdown;

  // Quotes and backups
  quotesOrder: QuoteOrder;
  quotesGroupByBook: boolean;
  backupReminder: BackupReminder;

  // The reading room (Decorate on the Room page; lib/room-styles.ts)
  roomStyle: RoomStyle;
  roomWalls: RoomWalls;
  roomWood: RoomWood;
  roomFabric: RoomFabric;
  roomHanging: RoomHanging;
  roomPaper: RoomPaper;
  roomFloor: RoomFloor;
  /** Fairy lights, bunting and the like along the top of every room. */
  roomCeiling: RoomCeiling;
  /** Added rooms' own walls and floors, by room; a room not here is like
   *  the rest of the house. */
  roomOwn: Partial<Record<RoomKind, RoomOwn>>;
  /** The coat of every cat in the house, and of the dog in its basket
   *  (lib/pets.ts). */
  roomCat: CatCoat;
  roomDog: DogCoat;
  /** Where furniture has been moved to. Empty = where it goes by itself. */
  roomLayout: Placement[];
  /** Furniture put away. */
  roomAway: Stowable[];
  /** Rooms added over the library (lib/room.ts), from the bottom up. */
  roomRooms: RoomKind[];
  /** Furniture added from the catalogue (lib/room.ts). */
  roomExtras: Extra[];
  // The reader's avatar in the room (lib/avatar.ts)
  /** Whether the avatar is in the room at all. */
  avatarShown: boolean;
  /** How it looks; saved whole. */
  avatar: AvatarLook;
  /** Looks kept to switch between (Decorate › Avatar › Saved looks). */
  avatarLooks: AvatarLook[];
  /** The animal that follows the avatar about (lib/pets.ts). */
  avatarPet: Pet;
};

export const DEFAULT_PREFERENCES: Preferences = {
  newBookFormat: BookFormat.PHYSICAL,
  newBookStatus: ReadingStatus.WANT_TO_READ,
  newBookOwnership: BookOwnership.OWNED,
  importTagsMode: "all",
  tagRenames: [],
  tagSkips: [],
  addedAsReadFinished: "today",
  afterAdd: "open",
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
  cardStyle: "raised",
  background: "plain",
  backgroundMotion: "moving",
  bookBackdrop: "cover",
  heatmapScale: "standard",
  startPage: "library",
  hiddenNav: [],
  hiddenStats: [],
  defaultViewId: "",
  pickOnlyHave: false,
  pickNextInSeries: false,
  quickLogSteps: "10-25",
  ebookUnit: "page",
  audiobookUnit: "page",
  paceFrom: "read",
  bookPageCards: [...BOOK_PAGE_CARDS],
  hiddenBookPageCards: [],
  bookDescription: "full",
  shelvesCard: "all",
  findLinks: [],
  searchAlsoIn: [],
  shelfOrder: [],
  hiddenShelves: [],
  savedViewOrder: [],
  hiddenStatusTabs: [],
  statsPagesRead: "finished",
  statsStoppedBooks: "none",
  statsAudiobooks: "full",
  statsPeriod: "all",
  statsBreakdown: "library",
  quotesOrder: "newest",
  quotesGroupByBook: false,
  backupReminder: "off",
  roomStyle: "cottage",
  roomWalls: "style",
  roomWood: "style",
  roomFabric: "style",
  roomHanging: "painting",
  roomPaper: "style",
  roomFloor: "style",
  roomCeiling: "none",
  roomOwn: {},
  roomCat: "ginger",
  roomDog: "brown",
  roomLayout: [],
  roomAway: [],
  roomRooms: [],
  roomExtras: [],
  avatarShown: true,
  avatar: DEFAULT_AVATAR,
  avatarLooks: [],
  avatarPet: "none",
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

/** Record ids (cuids), each once, in the order given, at most `max`. Ids of
 *  rows since deleted are kept; whoever uses the list skips them. */
function idList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (out.length >= max) break;
    if (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Why a "Find it at" link can't be saved, or null when it can. Checked on
 * trimmed values, in the order a person would fix them.
 */
export function findLinkError(rawName: string, rawUrl: string): string | null {
  const name = rawName.trim();
  const url = rawUrl.trim();
  if (!name) return "Give the link a name.";
  if (name.length > FIND_LINK_NAME_MAX) {
    return `Keep the name to ${FIND_LINK_NAME_MAX} characters or fewer.`;
  }
  if (!url) return "Add the link.";
  if (url.length > FIND_LINK_URL_MAX) {
    return `That link is too long (${FIND_LINK_URL_MAX} characters at most).`;
  }
  if (!/^https:\/\//i.test(url)) return "Links must start with https://.";
  if (/[{}]/.test(url.replace(/\{(isbn|title|author)\}/g, ""))) {
    return "Only {isbn}, {title} and {author} can be filled in.";
  }
  try {
    const parsed = new URL(url.replace(/\{(isbn|title|author)\}/g, "x"));
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      return "That isn't a web address.";
    }
  } catch {
    return "That isn't a web address.";
  }
  return null;
}

function parseFindLinks(value: unknown): FindLink[] {
  if (!Array.isArray(value)) return [];
  const out: FindLink[] = [];
  for (const item of value) {
    if (out.length >= MAX_FIND_LINKS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { name, url } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof url !== "string") continue;
    if (findLinkError(name, url) !== null) continue;
    out.push({ name: name.trim(), url: url.trim() });
  }
  return out;
}

/** A tag as a tag rule stores it (trimmed, lower case), or null when it
 *  could never be a tag. */
export function normalizeRuleTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().toLowerCase();
  if (!tag || tag.length > TAG_RULE_MAX || tag.includes(",")) return null;
  return tag;
}

/** One rule per `from`, the newest winning, keeping the newest
 *  MAX_TAG_RULES. */
function parseTagRenames(value: unknown): TagRename[] {
  if (!Array.isArray(value)) return [];
  const byFrom = new Map<string, string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const from = normalizeRuleTag((item as Record<string, unknown>).from);
    const to = normalizeRuleTag((item as Record<string, unknown>).to);
    if (!from || !to || from === to) continue;
    // Re-inserting moves it to the end, so the order stays oldest first.
    byFrom.delete(from);
    byFrom.set(from, to);
  }
  return [...byFrom].map(([from, to]) => ({ from, to })).slice(-MAX_TAG_RULES);
}

function parseTagSkips(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const tag = normalizeRuleTag(v);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(-MAX_TAG_RULES);
}

/** Furniture placements: a known piece once each, on a floor and in a
 *  slot no house could be taller or wider than. */
function parseRoomLayout(value: unknown): Placement[] {
  if (!Array.isArray(value)) return [];
  const out: Placement[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { kind, floor, slot, room } = item as Record<string, unknown>;
    if (typeof kind !== "string" || !(MOVABLE as readonly string[]).includes(kind)) continue;
    if (out.some((p) => p.kind === kind)) continue;
    const whole = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;
    if (!whole(floor, 100) || !whole(slot, 500)) continue;
    const place: Placement = { kind: kind as Placement["kind"], floor: floor as number, slot: slot as number };
    if (typeof room === "string" && (ROOMS as readonly string[]).includes(room)) place.room = room as RoomKind;
    out.push(place);
  }
  return out;
}

/** Added rooms' own walls and floors: known rooms only, each choice
 *  checked, and rooms just like the house left out. */
function parseRoomOwn(value: unknown): Partial<Record<RoomKind, RoomOwn>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<RoomKind, RoomOwn>> = {};
  for (const [room, own] of Object.entries(value)) {
    if (!(ROOMS as readonly string[]).includes(room) || !own || typeof own !== "object") continue;
    const o = own as Record<string, unknown>;
    const parsed: RoomOwn = {
      walls: pick(ROOM_WALLS, o.walls, "style"),
      paper: pick(ROOM_PAPERS, o.paper, "style"),
      floor: pick(ROOM_FLOORS, o.floor, "style"),
    };
    if (parsed.walls !== "style" || parsed.paper !== "style" || parsed.floor !== "style") out[room as RoomKind] = parsed;
  }
  return out;
}

/** Every book-page card once: the stored order first, then any card it
 *  leaves out (a card added in a later version, say) in default order. */
function parseBookPageCards(value: unknown): BookPageCard[] {
  const listed = pickList(BOOK_PAGE_CARDS, value);
  return [...listed, ...BOOK_PAGE_CARDS.filter((c) => !listed.includes(c))];
}

/** Stored JSON (or anything else) → a complete, safe Preferences. */
export function parsePreferences(raw: unknown): Preferences {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;

  const catalogues = Array.isArray(obj.catalogues)
    ? pickList(CATALOGUES, obj.catalogues)
    : d.catalogues;
  const statuses = Object.values(ReadingStatus);
  const hiddenStatusTabs = pickList(statuses, obj.hiddenStatusTabs);

  return {
    newBookFormat: pick(Object.values(BookFormat), obj.newBookFormat, d.newBookFormat),
    newBookStatus: pick(Object.values(ReadingStatus), obj.newBookStatus, d.newBookStatus),
    newBookOwnership: pick(
      Object.values(BookOwnership),
      obj.newBookOwnership,
      d.newBookOwnership,
    ),
    // importTags was a boolean before the three-way setting; an account that
    // turned it off keeps it off.
    importTagsMode: pick(
      IMPORT_TAGS_MODES,
      obj.importTagsMode,
      obj.importTags === false ? "off" : d.importTagsMode,
    ),
    tagRenames: parseTagRenames(obj.tagRenames),
    tagSkips: parseTagSkips(obj.tagSkips),
    addedAsReadFinished: pick(
      ADDED_AS_READ_FINISHED,
      obj.addedAsReadFinished,
      d.addedAsReadFinished,
    ),
    afterAdd: pick(AFTER_ADD, obj.afterAdd, d.afterAdd),
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
    cardStyle: pick(CARD_STYLES, obj.cardStyle, d.cardStyle),
    background: pick(BACKGROUNDS, obj.background, d.background),
    backgroundMotion: pick(BACKGROUND_MOTIONS, obj.backgroundMotion, d.backgroundMotion),
    bookBackdrop: pick(BOOK_BACKDROPS, obj.bookBackdrop, d.bookBackdrop),
    heatmapScale: pick(HEATMAP_SCALES, obj.heatmapScale, d.heatmapScale),
    startPage: pick(START_PAGES, obj.startPage, d.startPage),
    hiddenNav: pickList(HIDEABLE_NAV, obj.hiddenNav),
    hiddenStats: pickList(HIDEABLE_STATS, obj.hiddenStats),
    defaultViewId:
      typeof obj.defaultViewId === "string" && obj.defaultViewId.length <= 64
        ? obj.defaultViewId
        : d.defaultViewId,
    pickOnlyHave: bool(obj.pickOnlyHave, d.pickOnlyHave),
    pickNextInSeries: bool(obj.pickNextInSeries, d.pickNextInSeries),
    quickLogSteps: pick(QUICK_LOG_STEPS, obj.quickLogSteps, d.quickLogSteps),
    ebookUnit: pick(EBOOK_UNITS, obj.ebookUnit, d.ebookUnit),
    audiobookUnit: pick(AUDIOBOOK_UNITS, obj.audiobookUnit, d.audiobookUnit),
    paceFrom: pick(PACE_FROM, obj.paceFrom, d.paceFrom),
    bookPageCards: parseBookPageCards(obj.bookPageCards),
    hiddenBookPageCards: pickList(BOOK_PAGE_CARDS, obj.hiddenBookPageCards),
    bookDescription: pick(BOOK_DESCRIPTIONS, obj.bookDescription, d.bookDescription),
    shelvesCard: pick(SHELVES_CARD_MODES, obj.shelvesCard, d.shelvesCard),
    findLinks: parseFindLinks(obj.findLinks),
    searchAlsoIn: pickList(SEARCH_FIELDS, obj.searchAlsoIn),
    shelfOrder: idList(obj.shelfOrder, MAX_ORDERED_IDS),
    hiddenShelves: idList(obj.hiddenShelves, MAX_ORDERED_IDS),
    savedViewOrder: idList(obj.savedViewOrder, MAX_ORDERED_IDS),
    // Hiding every status would leave the library with no tabs at all, so
    // that reads as hiding none.
    hiddenStatusTabs: hiddenStatusTabs.length < statuses.length ? hiddenStatusTabs : [],
    statsPagesRead: pick(STATS_PAGES_READ, obj.statsPagesRead, d.statsPagesRead),
    statsStoppedBooks: pick(STATS_STOPPED_BOOKS, obj.statsStoppedBooks, d.statsStoppedBooks),
    statsAudiobooks: pick(STATS_AUDIOBOOKS, obj.statsAudiobooks, d.statsAudiobooks),
    statsPeriod: pick(STATS_PERIODS, obj.statsPeriod, d.statsPeriod),
    statsBreakdown: pick(STATS_BREAKDOWNS, obj.statsBreakdown, d.statsBreakdown),
    quotesOrder: pick(QUOTE_ORDERS, obj.quotesOrder, d.quotesOrder),
    quotesGroupByBook: bool(obj.quotesGroupByBook, d.quotesGroupByBook),
    backupReminder: pick(BACKUP_REMINDERS, obj.backupReminder, d.backupReminder),
    roomStyle: pick(ROOM_STYLES, obj.roomStyle, d.roomStyle),
    roomWalls: pick(ROOM_WALLS, obj.roomWalls, d.roomWalls),
    roomWood: pick(ROOM_WOODS, obj.roomWood, d.roomWood),
    roomFabric: pick(ROOM_FABRICS, obj.roomFabric, d.roomFabric),
    roomHanging: pick(ROOM_HANGINGS, obj.roomHanging, d.roomHanging),
    roomPaper: pick(ROOM_PAPERS, obj.roomPaper, d.roomPaper),
    roomFloor: pick(ROOM_FLOORS, obj.roomFloor, d.roomFloor),
    roomCeiling: pick(ROOM_CEILINGS, obj.roomCeiling, d.roomCeiling),
    roomOwn: parseRoomOwn(obj.roomOwn),
    roomCat: parseCatCoat(obj.roomCat),
    roomDog: parseDogCoat(obj.roomDog),
    roomLayout: parseRoomLayout(obj.roomLayout),
    roomAway: pickList(STOWABLE, obj.roomAway),
    roomRooms: pickList(ROOMS, obj.roomRooms),
    roomExtras: pickList(EXTRAS, obj.roomExtras),
    avatarShown: bool(obj.avatarShown, d.avatarShown),
    avatar: parseAvatar(obj.avatar),
    avatarLooks: parseSavedLooks(obj.avatarLooks),
    avatarPet: parsePet(obj.avatarPet),
  };
}

/** Where each start page lives. */
export const START_PAGE_PATHS: Record<StartPage, string> = {
  library: "/books",
  stats: "/stats",
  add: "/books/new",
  reading: "/reading",
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
