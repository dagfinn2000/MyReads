import { foldForSearch } from "@/lib/utils";

/**
 * The settings on the Account page, for quick find (Ctrl+K): each with the
 * Preferences section it sits in, the hint under it and a few other words
 * it goes by. Opening one goes to /account?find=<label>, where the Find a
 * setting box (components/settings-finder.tsx) jumps to it on the page.
 *
 * Kept by hand; settings-index.test.ts checks that every setting and
 * section the Preferences form names is here.
 */

export interface SettingEntry {
  label: string;
  /** The Preferences section it's in; null for a section itself, or a
   *  card of its own on the Account page. */
  section: string | null;
  hint?: string;
  aka?: string[];
}

export const SETTINGS: SettingEntry[] = [
  { label: "New books", section: null },
  { label: "Book search", section: null },
  { label: "Reading", section: null },
  { label: "Reading reminders", section: null, aka: ["notifications", "push"] },
  { label: "Dates and numbers", section: null },
  { label: "Sorting", section: null },
  { label: "Library", section: null },
  { label: "Reading statuses", section: null },
  { label: "Book fields", section: null },
  { label: "Moods", section: null },
  { label: "Pick for me", section: null, aka: ["random"] },
  { label: "Lending", section: null, aka: ["loans", "lent", "due date"] },
  { label: "Ratings", section: null },
  { label: "Theme", section: null, aka: ["dark mode", "light mode", "colours", "palette"] },
  { label: "Appearance", section: null },
  { label: "Motion", section: null },
  { label: "Sound", section: null },
  { label: "Text", section: null },
  { label: "Your own CSS", section: null, aka: ["custom css", "stylesheet"] },
  { label: "Pages and navigation", section: null },
  { label: "Reading room", section: null },
  { label: "Book page", section: null },
  { label: "Stats page", section: null },
  { label: "Saved views", section: null },
  { label: "Format", section: "New books" },
  { label: "Status", section: "New books" },
  { label: "Ownership", section: "New books" },
  { label: "Books I add as Read were finished", section: "New books", hint: "Bulk edit’s Set status: Read follows this too." },
  { label: "After adding a book", section: "New books" },
  { label: "Copy subjects from the catalogue as tags", section: "New books" },
  { label: "Step buttons", section: "Reading", hint: "The buttons next to the page box, in the book’s own unit: pages, percent or minutes." },
  { label: "Ebooks: track by", section: "Reading" },
  { label: "Audiobooks: track by", section: "Reading", hint: "Time needs the book’s length and a page count, both on its Edit page." },
  { label: "Pace from", section: "Reading", hint: "Used for pages a day and the finish forecast while you read." },
  { label: "Daily goal", section: "Reading", hint: "A ring on Now reading fills as you read each day. Minutes come from the reading timer.", aka: ["goal"] },
  { label: "Pages a day", section: "Reading" },
  { label: "Minutes a day", section: "Reading" },
  { label: "Time", section: "Reading reminders" },
  { label: "Not on a day I’ve already read", section: "Reading reminders" },
  { label: "Dates", section: "Dates and numbers" },
  { label: "Numbers", section: "Dates and numbers" },
  { label: "Weeks start on", section: "Dates and numbers" },
  { label: "Time zone", section: "Dates and numbers", hint: "Decides which day your reading counts on.", aka: ["timezone"] },
  { label: "Ignore “The”, “A” and “An” when sorting titles", section: "Sorting" },
  { label: "Authors", section: "Sorting" },
  { label: "Alphabet", section: "Sorting", hint: "Where letters like Æ, Ø, Å and Ö sort." },
  { label: "Status tabs to show", section: "Library" },
  { label: "Only books I have", section: "Pick for me" },
  { label: "Only the next book in a series", section: "Pick for me" },
  { label: "Lend books for", section: "Lending", hint: "Fills in the date a lent book is due back." },
  { label: "Remind me when a lent book is overdue", section: "Lending" },
  { label: "Rate books with", section: "Ratings", aka: ["stars", "rating style"] },
  { label: "Rate the plot, characters and writing too", section: "Ratings" },
  { label: "Accent colour", section: "Appearance", aka: ["highlight colour", "color"] },
  { label: "Background", section: "Appearance", aka: ["texture", "wallpaper"] },
  { label: "Books without a cover", section: "Appearance" },
  { label: "Reading progress on covers", section: "Appearance", hint: "A ribbon hangs from the top of a book you’re reading, down to how far you’ve got.", aka: ["ribbon", "bookmark"] },
  { label: "Reading progress on spines", section: "Appearance", hint: "In the library’s Spines view, a book you’re reading is in full colour only as far up as you’ve read, and fills up to there as the shelf opens.", aka: ["spine fill"] },
  { label: "Up next on Now reading", section: "Appearance", hint: "A pile restacks itself when you put your list in another order." },
  { label: "Shelf wear", section: "Appearance", hint: "Books untouched for a year or more gather a little dust, and ones read again and again, or rated 4½ stars or more, look well worn." },
  { label: "Dog-eared corners", section: "Appearance", hint: "A book you stopped reading has its top corner folded down, to keep your place for another go. The page you stopped at shows under the pointer." },
  { label: "Bookplate", section: "Appearance", hint: "An “Ex libris” plate under the cover of a printed book you own, with your name and its number in your library, counting in the order you added them.", aka: ["ex libris"] },
  { label: "Shadows under covers", section: "Appearance", hint: "A thin, even shadow under every cover, which lifts a little when the pointer is on one you can open.", aka: ["cover shadow"] },
  { label: "Spacing", section: "Appearance", hint: "On a book’s page and on Stats: more room between the cards, and the same steady space from one to the next." },
  { label: "Dividers", section: "Appearance", hint: "Between the sections of a card and of this page, and before a book’s cards and Stats’ cards." },
  { label: "Corners", section: "Appearance", hint: "Most themes are rounded; a few, like Terminal and Mondrian, are square." },
  { label: "Cards", section: "Appearance", hint: "Frosted lets the background show through, softly blurred." },
  { label: "Light through the day", section: "Appearance", hint: "Rain, snow, stars, aurora, ripples, the scene themes and the reading room warm up around sunrise and sunset and dim at night, by the clock where you are. Sky has its own.", aka: ["time of day", "daylight"] },
  { label: "Behind a book’s page", section: "Appearance" },
  { label: "Animations", section: "Motion", hint: "Always off when your device asks for reduced motion.", aka: ["motion", "reduce motion"] },
  { label: "Moving between pages", section: "Motion", hint: "Going to another page from the top bar.", aka: ["page turn"] },
  { label: "Switching tabs", section: "Motion", hint: "The library’s status tabs, shelves and saved views, the periods on Stats and the two ways to add a book." },
  { label: "Sorting and filtering", section: "Motion", hint: "The library’s books when you sort, filter or search it, and the quotes when you shuffle them." },
  { label: "Logging pages", section: "Motion", hint: "Page counts, percentages and the daily goal’s count as they change, and the progress bar." },
  { label: "Reading timer", section: "Motion", hint: "What shows the timer is running, beside the time read." },
  { label: "Opening a book", section: "Motion", hint: "Tapping a book’s cover in the library, a series or anywhere else covers show.", aka: ["book opening"] },
  { label: "Celebrations", section: "Motion", hint: "When you finish a book or reach a goal.", aka: ["confetti"] },
  { label: "Finishing a book", section: "Motion", hint: "As well as the celebration, a few loose pages can come away from the book and flutter down." },
  { label: "Moving backgrounds", section: "Motion", hint: "Falling rain and snow, twinkling stars, drifting aurora and ripples, and the forest themes’ fireflies and leaves." },
  { label: "Covers follow the pointer", section: "Motion", hint: "Covers in the library and on a book’s page tilt toward the pointer and catch the light. With a mouse or trackpad." },
  { label: "Sounds", section: "Sound", hint: "Soft sounds when you log pages, put a book on a shelf, finish a book, reach your daily goal, add a book or rate one. Only for what you do, never on their own.", aka: ["audio", "sound effects"] },
  { label: "Volume", section: "Sound" },
  { label: "Which sounds", section: "Sound" },
  { label: "Text size", section: "Text", aka: ["font size", "bigger text", "zoom"] },
  { label: "Font", section: "Text", hint: "Everything, unless Headings or Long text below picks a face of its own. Some themes have a face of their own, like Terminal’s; a face picked here wins.", aka: ["typeface"] },
  { label: "Headings", section: "Text", hint: "Page titles, book titles and card titles." },
  { label: "Long text", section: "Text", hint: "Descriptions, reviews, quotes and notes." },
  { label: "Book typography", section: "Text", hint: "A drop cap opening each book’s description and an ornament closing it, quotes hung on a large quote mark, and old-style numbers where the font has them." },
  { label: "Start page", section: "Pages and navigation", hint: "Where the app opens, and where the logo goes.", aka: ["home page", "first page"] },
  { label: "Library opens on", section: "Pages and navigation" },
  { label: "Keyboard shortcuts", section: "Pages and navigation", aka: ["hotkeys", "keys"] },
  { label: "The reading room", section: "Reading room", aka: ["room", "house"] },
  { label: "Show my avatar in the room", section: "Reading room" },
  { label: "Light a candle while the reading timer runs", section: "Reading room" },
  { label: "Long descriptions", section: "Book page" },
  { label: "Shelves card", section: "Book page", hint: "What the Shelves card lists on a book." },
  { label: "Show these cards", section: "Stats page" },
  { label: "Calendar shading", section: "Stats page", hint: "Pages a day for each shade of the reading calendar. Its Time view goes by minutes instead (15, 30 and 60 on Standard)." },
  { label: "Big numbers", section: "Stats page", hint: "The big numbers write themselves in as they come into view, like ink from a pen. Not when animations are off." },
  { label: "Stats open on", section: "Stats page", hint: "The buttons on the Stats page switch it any time." },
  { label: "Genres and Formats count", section: "Stats page" },
  { label: "Pages read means", section: "Stats page", hint: "Books you finish without logging still add their page count." },
  { label: "Books I stop reading", section: "Stats page" },
  { label: "Audiobooks", section: "Stats page" },
  { label: "Change password", section: null, aka: ["password"] },
  { label: "Backup", section: null, aka: ["export", "download", "restore", "zip"] },
  { label: "Delete account", section: null },
];

/** Where a setting opens. */
export function settingHref(entry: Pick<SettingEntry, "label">): string {
  return `/account?find=${encodeURIComponent(entry.label)}`;
}

/** The query with its plurals made singular too, so "fonts" finds
 *  "Font": the two to try, or one when nothing changes. */
export function queryForms(q: string): string[] {
  const singular = q.replace(/(\p{L}{3,}?)(?:es|s)\b/gu, (word, stem: string) =>
    /(ss|us|is)$/i.test(word) ? word : word.endsWith("es") && !/(ch|sh|x|z)es$/i.test(word) ? `${stem}e` : stem,
  );
  return singular === q ? [q] : [q, singular];
}

/** The settings that answer the query, best first: its name over the
 *  words it goes by, over its hint. */
export function matchSettings(
  q: string,
  limit: number,
  match: (name: string, q: string) => number,
): SettingEntry[] {
  if (!foldForSearch(q).trim()) return [];
  const forms = queryForms(q);
  const score = (name: string) => Math.max(...forms.map((f) => match(name, f)));
  return SETTINGS.map((s) => ({
    s,
    score: Math.max(
      score(s.label) * 3,
      ...(s.aka ?? []).map((a) => score(a) * 2),
      s.hint ? score(s.hint) * 0.5 : 0,
    ),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}
