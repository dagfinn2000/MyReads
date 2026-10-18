import { z } from "zod";
import { keyToUtcDate } from "@/lib/dates";

/**
 * What the progress actions (lib/actions/progress.ts) accept from the
 * client: the zod schemas for logging a page, fixing an entry and undoing
 * Finished or Stopped. Kept apart from reading-log.ts, which client
 * components import for its helpers, so zod never ships to the browser.
 */

export const MAX_PAGE = 100_000;

/** A record id from the client. Anything else is "not found", never a
 *  database error. */
export const idSchema = z.string().min(1).max(64);

/** "2026-10-09", and a real date: 2026-02-30 isn't. */
export const dayKeySchema = z
  .string()
  .refine(
    (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && keyToUtcDate(k).toISOString().slice(0, 10) === k,
    "Pick a day",
  );

export const dayChoiceSchema = z.union([z.literal("today"), z.literal("yesterday"), dayKeySchema]);

const pageField = z.coerce
  .number()
  .int("Log a whole page")
  .min(1, "Log at least page 1")
  .max(MAX_PAGE, "That page is too high");

/** The position as typed, in the book's unit, so messages can say it back
 *  as typed. Only ever shown; anything odd is dropped, never refused. */
const typedValue = z.number().int().min(0).max(1_000_000).optional().catch(undefined);

export const logPageSchema = z.object({
  page: pageField,
  day: dayChoiceSchema.default("today"),
  value: typedValue,
});

export const editEntrySchema = z.object({
  page: pageField,
  day: dayKeySchema,
  value: typedValue,
});

export const moveTargetSchema = z.enum(["READ", "DNF"]);

/**
 * What the client hands back to undo Finished or Stopped. It only names the
 * move; the server works out the rest from the book. `finishedAt` is the
 * finish moment the move wrote, so an undo can't land on a book finished
 * again since. `page` restores the page of a book with no reading log,
 * which a finish clears and nothing else remembers.
 */
export const undoMoveSchema = z.object({
  from: moveTargetSchema,
  finishedAt: z.string().datetime().nullable(),
  page: z.number().int().min(1).max(MAX_PAGE).nullable(),
});

export type UndoMove = z.infer<typeof undoMoveSchema>;
