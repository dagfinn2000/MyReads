import { formatDayKey, formatDecimal, type FormatPrefs } from "@/lib/display";
import { foldForSearch } from "@/lib/utils";

/**
 * The reader's own book fields (Preferences › Book fields): up to
 * MAX_BOOK_FIELDS, each a name and a type. A book's values live in
 * Book.fields by field id, so renaming a field keeps them. Values are
 * checked against the fields as they stand wherever they are read or
 * written: one whose field is gone, or that no longer fits it (an option
 * taken away), counts as no value, and the actions that change fields
 * clear such values from the books.
 */

export const MAX_BOOK_FIELDS = 20;
export const FIELD_NAME_MAX = 40;
export const MAX_FIELD_OPTIONS = 30;
export const FIELD_OPTION_MAX = 40;
export const FIELD_TEXT_MAX = 500;
/** Numbers beyond this either way are typos. */
const NUMBER_LIMIT = 1e12;

export const FIELD_TYPES = ["text", "number", "date", "yesno", "choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  yesno: "Yes or no",
  choice: "Choice",
};

export type BookField = {
  /** Stable id, the key of the book's value; renaming keeps it. */
  id: string;
  name: string;
  /** Fixed once added. */
  type: FieldType;
  /** A choice field's options, in order; empty for the other types. */
  options: string[];
};

/** A value as stored: text and choices as strings, dates as "YYYY-MM-DD". */
export type FieldValue = string | number | boolean;
export type FieldValues = Record<string, FieldValue>;

const ID = /^[a-z0-9]{1,16}$/;

/** True for a string that could be a field's id. */
export function isFieldId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/** One line of text: no control characters, inner runs of space made one,
 *  trimmed; null when empty or longer than `max`. */
export function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const line = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return line && line.length <= max ? line : null;
}

/** Fields as kept in Preferences: known types, each id and each name
 *  (ignoring case) once, a choice's options each once, all within the
 *  limits. */
export function parseBookFields(value: unknown): BookField[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const out: BookField[] = [];
  for (const item of value) {
    if (out.length >= MAX_BOOK_FIELDS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { id, name: rawName, type, options } = item as Record<string, unknown>;
    const name = cleanLine(rawName, FIELD_NAME_MAX);
    if (!isFieldId(id) || !name || ids.has(id) || names.has(name.toLowerCase())) continue;
    if (!(FIELD_TYPES as readonly string[]).includes(type as string)) continue;
    ids.add(id);
    names.add(name.toLowerCase());
    out.push({
      id,
      name,
      type: type as FieldType,
      options: type === "choice" ? parseOptions(options) : [],
    });
  }
  return out;
}

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (out.length >= MAX_FIELD_OPTIONS) break;
    const option = cleanLine(raw, FIELD_OPTION_MAX);
    if (!option || seen.has(option.toLowerCase())) continue;
    seen.add(option.toLowerCase());
    out.push(option);
  }
  return out;
}

/** "YYYY-MM-DD" for a real calendar day from the year 1000 on, else null. */
function cleanDate(value: string): string | null {
  const m = /^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? m[0] : null;
}

/** A number typed or stored: "1 234,5" and "1,234.5" both read as
 *  1234.5. Null for anything else, or past the limits. */
function cleanNumber(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    let s = value.trim().replace(/[\s  ]/g, "");
    // A lone comma is a decimal mark; with a dot as well, it groups.
    s = s.includes(".") ? s.replace(/,/g, "") : s.replace(",", ".");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    n = Number(s);
  } else return null;
  if (!Number.isFinite(n) || Math.abs(n) > NUMBER_LIMIT) return null;
  return Math.round(n * 1e4) / 1e4;
}

/**
 * A value for `field`, as stored, or null when it isn't one: text within
 * FIELD_TEXT_MAX, a number, a real date, yes or no, or one of the
 * choice's options (matched ignoring case, kept as the option is written).
 * Forms send strings ("yes", "2024-05-01"), backups the stored types.
 */
export function cleanFieldValue(field: BookField, value: unknown): FieldValue | null {
  switch (field.type) {
    case "text":
      return cleanLine(value, FIELD_TEXT_MAX);
    case "number":
      return cleanNumber(value);
    case "date":
      return typeof value === "string" ? cleanDate(value) : null;
    case "yesno":
      if (typeof value === "boolean") return value;
      if (value === "yes" || value === "true") return true;
      if (value === "no" || value === "false") return false;
      return null;
    case "choice": {
      if (typeof value !== "string") return null;
      const wanted = value.trim().toLowerCase();
      return field.options.find((o) => o.toLowerCase() === wanted) ?? null;
    }
  }
}

/** A book's stored values, only those that still fit the reader's fields,
 *  in the fields' order. */
export function cleanFieldValues(value: unknown, fields: readonly BookField[]): FieldValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: FieldValues = {};
  for (const field of fields) {
    if (!Object.hasOwn(raw, field.id)) continue;
    const v = cleanFieldValue(field, raw[field.id]);
    if (v !== null) out[field.id] = v;
  }
  return out;
}

/** The form field a book field's value travels in. */
export function fieldInputName(id: string): string {
  return `field:${id}`;
}

/**
 * The values a book form sends, on top of the book's current ones: a field
 * the form sent and left empty is cleared, one it didn't send keeps its
 * value (a field added in another tab since the form was drawn, say). An
 * error names the first field whose value can't be read.
 */
export function fieldValuesFromForm(
  formData: FormData,
  fields: readonly BookField[],
  current: FieldValues = {},
): { values: FieldValues; error?: string } {
  const values: FieldValues = { ...current };
  for (const field of fields) {
    const raw = formData.get(fieldInputName(field.id));
    if (typeof raw !== "string") continue;
    if (!raw.trim()) {
      delete values[field.id];
      continue;
    }
    const v = cleanFieldValue(field, raw);
    if (v === null) {
      // An option taken away while the form was open just goes.
      if (field.type === "choice") delete values[field.id];
      else return { values, error: fieldValueError(field) };
    } else values[field.id] = v;
  }
  return { values: cleanFieldValues(values, fields) };
}

function fieldValueError(field: BookField): string {
  switch (field.type) {
    case "number":
      return `“${field.name}” needs a number.`;
    case "date":
      return `“${field.name}” needs a date.`;
    case "text":
      return `“${field.name}” can be at most ${FIELD_TEXT_MAX} characters, on one line.`;
    default:
      return `“${field.name}” needs one of its own values.`;
  }
}

/** The text and choice values, folded for search (Book.fieldSearchText). */
export function fieldSearchText(values: FieldValues, fields: readonly BookField[]): string {
  return foldForSearch(
    fields
      .filter((f) => (f.type === "text" || f.type === "choice") && typeof values[f.id] === "string")
      .map((f) => values[f.id])
      .join(" "),
  );
}

/** A value as the book page shows it. */
export function formatFieldValue(field: BookField, value: FieldValue, prefs?: FormatPrefs): string {
  if (field.type === "yesno") return value ? "Yes" : "No";
  if (field.type === "number" && typeof value === "number") return formatDecimal(value, prefs);
  if (field.type === "date" && typeof value === "string") return formatDayKey(value, prefs?.dateFormat);
  return String(value);
}

/** A value as a form field holds it. */
export function fieldInputValue(value: FieldValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * The library's filter on one field (?field=…), in one URL parameter:
 *   `id`          has a value
 *   `id!`         has none
 *   `id=value`    is that choice, or yes/no
 *   `id:min..max` a number or date range, either end left open
 */
export type FieldFilter =
  | { id: string; op: "any" }
  | { id: string; op: "none" }
  | { id: string; op: "is"; value: string }
  | { id: string; op: "range"; min: string; max: string };

export function parseFieldFilter(s: string): FieldFilter | null {
  if (s.length > 120) return null;
  let m = /^([a-z0-9]{1,16})(!?)$/.exec(s);
  if (m) return m[2] ? { id: m[1], op: "none" } : { id: m[1], op: "any" };
  m = /^([a-z0-9]{1,16})=(.+)$/.exec(s);
  if (m) return { id: m[1], op: "is", value: m[2] };
  m = /^([a-z0-9]{1,16}):(.*)$/.exec(s);
  const ends = m?.[2].split("..");
  if (!m || ends?.length !== 2 || !(ends[0] || ends[1])) return null;
  if (ends[0].length > 24 || ends[1].length > 24) return null;
  return { id: m[1], op: "range", min: ends[0], max: ends[1] };
}

export function serializeFieldFilter(f: FieldFilter): string {
  switch (f.op) {
    case "any":
      return f.id;
    case "none":
      return `${f.id}!`;
    case "is":
      return `${f.id}=${f.value}`;
    case "range":
      return `${f.id}:${f.min}..${f.max}`;
  }
}

export type ResolvedFieldFilter =
  | { field: BookField; op: "any" }
  | { field: BookField; op: "none" }
  | { field: BookField; op: "is"; value: FieldValue }
  | { field: BookField; op: "range"; min: FieldValue | null; max: FieldValue | null };

/**
 * What a field filter asks for, checked against the field: the stored
 * value to match, or a range's ends. Null when the filter doesn't fit the
 * field (a range on a text field, an option that's gone), which then
 * filters nothing.
 */
export function resolveFieldFilter(
  f: FieldFilter,
  fields: readonly BookField[],
): ResolvedFieldFilter | null {
  const field = fields.find((x) => x.id === f.id);
  if (!field) return null;
  if (f.op === "any") return { field, op: "any" };
  if (f.op === "none") return { field, op: "none" };
  if (f.op === "is") {
    if (field.type !== "choice" && field.type !== "yesno") return null;
    const value = cleanFieldValue(field, f.value);
    return value === null ? null : { field, op: "is", value };
  }
  if (field.type !== "number" && field.type !== "date") return null;
  const end = (s: string) => (s ? cleanFieldValue(field, s) : null);
  const min = end(f.min);
  const max = end(f.max);
  if ((f.min && min === null) || (f.max && max === null)) return null;
  return { field, op: "range", min, max };
}

/** The filter's chip in the library ("Signed: Yes", "Price: 5 to 20"). */
export function fieldFilterLabel(s: string, fields: readonly BookField[], prefs?: FormatPrefs): string | null {
  const f = parseFieldFilter(s);
  const r = f && resolveFieldFilter(f, fields);
  if (!r) return null;
  const name = r.field.name;
  if (r.op === "any" || r.op === "none") return `${name}: ${r.op === "any" ? "any" : "no"} value`;
  if (r.op === "is") return `${name}: ${formatFieldValue(r.field, r.value, prefs)}`;
  const show = (v: FieldValue) => formatFieldValue(r.field, v, prefs);
  if (r.min !== null && r.max !== null) return `${name}: ${show(r.min)} to ${show(r.max)}`;
  if (r.min !== null) return `${name}: ${r.field.type === "date" ? "from" : "at least"} ${show(r.min)}`;
  return `${name}: ${r.field.type === "date" ? "until" : "at most"} ${show(r.max!)}`;
}
