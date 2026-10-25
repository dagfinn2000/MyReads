import { ReadingStatus } from "@/lib/enums";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/display";

/**
 * The reader's own reading statuses (Preferences › Reading statuses).
 *
 * The four built-in statuses can be renamed, and up to MAX_CUSTOM_STATUSES
 * more added, each built on one of the four: "Paused" on Currently Reading,
 * say. A book's `status` is always the base status, so stats, goals,
 * challenges and every filter keep counting as they always have; the custom
 * one rides along in Book.statusKey and only changes what the book is
 * called. A key whose status is gone, or whose base isn't the book's
 * status, is ignored everywhere (and cleared by the actions that change a
 * book's status, and when a status is deleted).
 */

export const MAX_CUSTOM_STATUSES = 12;
export const STATUS_NAME_MAX = 30;

/** Colours a custom status can be, each a badge tint like the built-in
 *  ones (light and dark). */
export const STATUS_COLORS = [
  "slate",
  "sky",
  "indigo",
  "violet",
  "pink",
  "rose",
  "orange",
  "amber",
  "lime",
  "teal",
] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export const STATUS_COLOR_LABELS: Record<StatusColor, string> = {
  slate: "Grey",
  sky: "Sky",
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink",
  rose: "Rose",
  orange: "Orange",
  amber: "Amber",
  lime: "Lime",
  teal: "Teal",
};

/** Written out in full so Tailwind finds every class. */
export const STATUS_COLOR_BADGE: Record<StatusColor, string> = {
  slate: "status-badge bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 border-transparent",
  sky: "status-badge bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-transparent",
  indigo: "status-badge bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border-transparent",
  violet: "status-badge bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200 border-transparent",
  pink: "status-badge bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200 border-transparent",
  rose: "status-badge bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-transparent",
  orange: "status-badge bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border-transparent",
  amber: "status-badge bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent",
  lime: "status-badge bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200 border-transparent",
  teal: "status-badge bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-transparent",
};

/** The colour as a dot (menus and the Preferences list). */
export const STATUS_COLOR_DOT: Record<StatusColor, string> = {
  slate: "bg-slate-500",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  lime: "bg-lime-500",
  teal: "bg-teal-500",
};

export type CustomStatus = {
  /** Stable id, kept on books (Book.statusKey); renaming keeps it. */
  key: string;
  name: string;
  /** The built-in status it is a kind of. Fixed once added. */
  base: ReadingStatus;
  color: StatusColor;
};

/** New names for the built-in statuses; one left out keeps its own. */
export type StatusNames = Partial<Record<ReadingStatus, string>>;

/** What naming a status needs from Preferences. */
export type StatusPrefs = { statusNames: StatusNames; customStatuses: CustomStatus[] };

const KEY = /^[a-z0-9]{1,16}$/;

/** True for a string that could be a custom status's key. */
export function isStatusKey(value: unknown): value is string {
  return typeof value === "string" && KEY.test(value);
}

/** A name as stored: trimmed, inner runs of space made one, no control
 *  characters; null when empty or too long. */
export function cleanStatusName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return name && name.length <= STATUS_NAME_MAX ? name : null;
}

const BASES = Object.values(ReadingStatus);
const isBase = (value: unknown): value is ReadingStatus =>
  typeof value === "string" && (BASES as string[]).includes(value);

export function parseStatusNames(value: unknown): StatusNames {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: StatusNames = {};
  for (const status of BASES) {
    const name = cleanStatusName((value as Record<string, unknown>)[status]);
    // A "rename" to the name it already has is no rename.
    if (name && name !== STATUS_LABELS[status]) out[status] = name;
  }
  return out;
}

/** Known bases and colours, each key and each name (ignoring case) once,
 *  at most MAX_CUSTOM_STATUSES. */
export function parseCustomStatuses(value: unknown): CustomStatus[] {
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>();
  const names = new Set<string>();
  const out: CustomStatus[] = [];
  for (const item of value) {
    if (out.length >= MAX_CUSTOM_STATUSES) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { key, name: rawName, base, color } = item as Record<string, unknown>;
    const name = cleanStatusName(rawName);
    if (!isStatusKey(key) || !name || !isBase(base) || keys.has(key)) continue;
    if (names.has(name.toLowerCase())) continue;
    keys.add(key);
    names.add(name.toLowerCase());
    out.push({
      key,
      name,
      base,
      color: (STATUS_COLORS as readonly string[]).includes(color as string) ? (color as StatusColor) : "slate",
    });
  }
  return out;
}

/** A built-in status by the reader's name for it. */
export function statusName(status: ReadingStatus, prefs: Pick<StatusPrefs, "statusNames">): string {
  return prefs.statusNames[status] ?? STATUS_LABELS[status];
}

/** The custom status a book is on, or null: its key must name one of the
 *  reader's statuses, built on the book's own status. */
export function customStatusOf(
  book: { status: ReadingStatus; statusKey?: string | null },
  prefs: Pick<StatusPrefs, "customStatuses">,
): CustomStatus | null {
  if (!book.statusKey) return null;
  return prefs.customStatuses.find((c) => c.key === book.statusKey && c.base === book.status) ?? null;
}

/** What a book's status is called. */
export function bookStatusName(
  book: { status: ReadingStatus; statusKey?: string | null },
  prefs: StatusPrefs,
): string {
  return customStatusOf(book, prefs)?.name ?? statusName(book.status, prefs);
}

/** The badge tint for a book's status. */
export function bookStatusBadge(
  book: { status: ReadingStatus; statusKey?: string | null },
  prefs: Pick<StatusPrefs, "customStatuses">,
): string {
  const custom = customStatusOf(book, prefs);
  return custom ? STATUS_COLOR_BADGE[custom.color] : STATUS_BADGE_CLASS[book.status];
}

/**
 * A status menu's value: the built-in status alone ("READING"), or with a
 * custom status's key ("READING:k3f9"). Forms send it as `status`.
 */
export function statusChoice(status: ReadingStatus, statusKey?: string | null): string {
  return statusKey ? `${status}:${statusKey}` : status;
}

/** A status menu's value back to a status and key. The key only stays when
 *  it names one of the reader's statuses on that base; anything unknown
 *  gives null. */
export function parseStatusChoice(
  value: unknown,
  prefs: Pick<StatusPrefs, "customStatuses">,
): { status: ReadingStatus; statusKey: string | null } | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const [status, key, ...rest] = value.split(":");
  if (!isBase(status) || rest.length > 0) return null;
  if (key === undefined) return { status, statusKey: null };
  const custom = customStatusOf({ status, statusKey: key }, prefs);
  return { status, statusKey: custom ? custom.key : null };
}

/** One entry of a status menu. */
export type StatusOption = {
  value: string;
  label: string;
  status: ReadingStatus;
  /** Set for a custom status: shown under its base. */
  color?: StatusColor;
};

/** Every status a book can be put on, each custom status under its base. */
export function statusOptions(prefs: StatusPrefs): StatusOption[] {
  return BASES.flatMap((status) => [
    { value: status, label: statusName(status, prefs), status },
    ...prefs.customStatuses
      .filter((c) => c.base === status)
      .map((c) => ({ value: statusChoice(status, c.key), label: c.name, status, color: c.color })),
  ]);
}
