import { z } from "zod";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";

/**
 * What a stored cover URL may be: a local path ("/api/covers/…") or an
 * http(s) URL. Not `javascript:` or `data:`, and not a protocol-relative
 * `//host/x` or `/\host/x`, which start with "/" but point off-site.
 * Shared by the book form and the backup import.
 */
export function isAllowedCoverUrl(s: string): boolean {
  return s === "" || /^\/(?![/\\])/.test(s) || /^https?:\/\//i.test(s);
}

/** Shared by registration and the change-password form. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  // bcrypt only uses the first 72 bytes; reject rather than silently truncate
  .max(72, "Password must be at most 72 characters");

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, and . _ -",
    ),
  password: passwordSchema,
});

/** Account page: change password. The current password re-proves identity —
 *  a stolen session cookie alone must not be enough to take the account. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

/** Shared shape for creating and editing books. Forms submit strings; this
 *  schema does the coercion so server actions can pass FormData through. */
export const bookSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  /** Comma-separated in the form; stored as an array. */
  authors: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    ),
  isbn: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s.replace(/[\s-]/g, "") || null)
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(10000)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  /**
   * Either a local cache path ("/api/covers/…") or a remote image URL the
   * user pasted. Bounded like every other free-text field — this was the one
   * that had no `.max()`, while the import schema capped the same field at
   * 2000 — and restricted to http(s) so a `javascript:` or `data:` value
   * can't be stored and later rendered into an attribute.
   */
  coverUrl: z
    .string()
    .trim()
    .max(2000, "Cover URL must be at most 2000 characters")
    .refine(isAllowedCoverUrl, "Cover URL must be an http(s) URL")
    .transform((s) => s || null)
    .nullable()
    .optional(),
  pageCount: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .nullable()
    .optional()
    .catch(null),
  /** An audiobook's running time in whole minutes (the form's hours and
   *  minutes, added up). Blank is "not known". Same bounds as the backup
   *  import, and a bad value is reported rather than quietly dropped. */
  lengthMinutes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.coerce
      .number()
      .int("Length must be whole minutes")
      .min(1, "Length must be at least 1 minute")
      .max(60000, "Length must be at most 1,000 hours")
      .nullable()
      .optional(),
  ),
  publishedDate: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  tags: z
    .string()
    .transform((s) => [
      // Deduped: metadata subjects often differ only in case ("Fiction",
      // "fiction"), which collide after lowercasing — and duplicate tags
      // break React keys wherever tags render.
      ...new Set(
        s
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ]),
  seriesName: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  /** Position in a series; float so novellas can slot in at 1.5. A blank
   *  field is no number, not #0: `z.coerce` alone turns "" into 0, and 0 is
   *  a real position (prequels are often numbered 0). */
  seriesNumber: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.coerce.number().min(0).max(10000).nullable().optional().catch(null),
  ),
  format: z.nativeEnum(BookFormat),
  /** Defaults to OWNED so a form that omits the field (or sends something
   *  unexpected) still saves as an ordinary book on your shelf. */
  ownership: z.nativeEnum(BookOwnership).catch(BookOwnership.OWNED),
  openLibraryId: z
    .string()
    .trim()
    .transform((s) => s || null)
    .nullable()
    .optional(),
});

/** "" → null, unparseable → null, otherwise a valid Date. */
function parseDateOrNull(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Started/finished dates must make sense together: no finishing before you
 * started (it shows up as a negative "fastest read"), and nothing in the
 * future. "Future" allows a day's slack, because the form sends a calendar
 * date read as midnight UTC, which is already tomorrow east of UTC.
 */
function checkReadDates(
  d: { dateStarted?: Date | null; dateFinished?: Date | null },
  ctx: z.RefinementCtx,
) {
  const latest = Date.now() + 86_400_000;
  if (d.dateStarted && d.dateStarted.getTime() > latest) {
    ctx.addIssue({ code: "custom", path: ["dateStarted"], message: "Start date is in the future" });
  }
  if (d.dateFinished && d.dateFinished.getTime() > latest) {
    ctx.addIssue({ code: "custom", path: ["dateFinished"], message: "Finish date is in the future" });
  }
  if (d.dateStarted && d.dateFinished && d.dateFinished < d.dateStarted) {
    ctx.addIssue({
      code: "custom",
      path: ["dateFinished"],
      message: "Finish date is before the start date",
    });
  }
}

/** Personal reading data, editable from the book detail page. */
export const readingSchema = z.object({
  status: z.nativeEnum(ReadingStatus),
  /** 1–10 half-star units; empty string/0 clears the rating. */
  rating: z.coerce.number().int().min(0).max(10).nullable().optional().catch(null),
  review: z
    .string()
    .trim()
    .max(20000)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  dateStarted: z
    .string()
    .transform(parseDateOrNull)
    .nullable()
    .optional(),
  dateFinished: z
    .string()
    .transform(parseDateOrNull)
    .nullable()
    .optional(),
  /** Reading progress; empty string/0 clears it. */
  currentPage: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .optional()
    .catch(null),
  /** The "Don't remember" box next to the finish date: a ticked checkbox
   *  sends "on", an unticked one sends nothing. */
  finishedUnknown: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
}).superRefine(checkReadDates);

/** A past read of a book (the read-history card). Everything is optional:
 *  "I know I read this in 2019" and a fully undated "read it before" are
 *  both valid entries. */
export const pastReadSchema = z.object({
  dateStarted: z
    .string()
    .transform(parseDateOrNull)
    .nullable()
    .optional(),
  dateFinished: z
    .string()
    .transform(parseDateOrNull)
    .nullable()
    .optional(),
  /** 1–10 half-star units; empty string/0 means "unrated that time". */
  rating: z.coerce.number().int().min(0).max(10).nullable().optional().catch(null),
  /** "Read it aloud to the kids"; empty clears it. Same limit as restore. */
  note: z
    .string()
    .trim()
    .max(2000, "Keep the note to 2000 characters or fewer.")
    .transform((s) => s || null)
    .nullable()
    .optional(),
}).superRefine(checkReadDates);

/** A quote/highlight from the book detail page. Forms submit strings. */
export const quoteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Quote text is required")
    .max(5000, "Quote must be at most 5000 characters"),
  /** Page reference; empty string/0 means "no page". */
  page: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .optional()
    .catch(null),
  note: z
    .string()
    .trim()
    .max(2000)
    .transform((s) => s || null)
    .nullable()
    .optional(),
});

/** Lending a copy out. Only the borrower is required — "I lent it to Kari"
 *  is a complete thought, and the date defaults to today. */
export const loanSchema = z.object({
  borrower: z
    .string()
    .trim()
    .min(1, "Who has it?")
    .max(100, "Name must be at most 100 characters"),
  lentAt: z
    .string()
    .transform(parseDateOrNull)
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((s) => s || null)
    .nullable()
    .optional(),
});

export const shelfNameSchema = z
  .string()
  .trim()
  .min(1, "Shelf name is required")
  .max(50, "Shelf name must be at most 50 characters");

export type BookInput = z.infer<typeof bookSchema>;
export type ReadingInput = z.infer<typeof readingSchema>;
