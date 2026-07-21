import { z } from "zod";
import { BookFormat, ReadingStatus } from "@prisma/client";

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
  coverUrl: z
    .string()
    .trim()
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
  /** Position in a series; float so novellas can slot in at 1.5. */
  seriesNumber: z.coerce
    .number()
    .min(0)
    .max(10000)
    .nullable()
    .optional()
    .catch(null),
  format: z.nativeEnum(BookFormat),
  owned: z.coerce.boolean(),
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
});

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
});

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

export const shelfNameSchema = z
  .string()
  .trim()
  .min(1, "Shelf name is required")
  .max(50, "Shelf name must be at most 50 characters");

export type BookInput = z.infer<typeof bookSchema>;
export type ReadingInput = z.infer<typeof readingSchema>;
