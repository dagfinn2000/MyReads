import { z } from "zod";
import type { UndoMove } from "@/lib/reading-log";
import { clientIdSchema, idSchema, moveTargetSchema } from "@/lib/reading-log-input";
import { logPageAs, moveFromReadingAs } from "@/lib/reading-log-write";

/**
 * Reading a browser saved while it couldn't reach the server, sent when it
 * can (POST /api/reading/sync, from lib/outbox.ts): pages logged and books
 * finished or stopped, oldest first. Each is written as if it had been
 * sent at the moment it was made, by the same code as the quick-log row,
 * with the same checks, so one the book no longer allows (finished on
 * another device, say) comes back with the reason.
 *
 * Each carries the browser's own id. A log already written (the first send
 * got through, only its answer didn't) finds its entry by that id and is
 * not written again; a Finished or Stopped for a book already there has
 * nothing left to do.
 */

export const MAX_SYNC_ITEMS = 100;

/** When it was made: milliseconds since 1970, as Date.now() gives it. */
const madeAt = z.number().int().min(0).max(8.64e15);

const syncItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("log"),
    id: clientIdSchema,
    bookId: idSchema,
    // Checked by logPageAs, with its own messages.
    page: z.unknown(),
    day: z.unknown(),
    value: z.unknown().optional(),
    minutes: z.unknown().optional(),
    at: madeAt,
  }),
  z.object({
    kind: z.literal("move"),
    id: clientIdSchema,
    bookId: idSchema,
    to: moveTargetSchema,
    minutes: z.unknown().optional(),
    at: madeAt,
  }),
]);

export type SyncItem = z.infer<typeof syncItemSchema>;

export type SyncResult =
  | { id: string; ok: true; message: string; undo?: UndoMove }
  /** `retry`: the server failed, not the item; send it again later. */
  | { id: string; ok: false; error: string; retry?: boolean };

const SERVER_FAILED = "The server couldn't save this one. It tries again later.";

async function syncOne(userId: string, raw: unknown): Promise<SyncResult> {
  const rawId =
    raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string"
      ? (raw as { id: string }).id
      : "";
  const parsed = syncItemSchema.safeParse(raw);
  if (!parsed.success) return { id: rawId, ok: false, error: "This couldn't be read." };
  const item = parsed.data;
  const at = new Date(item.at);
  try {
    if (item.kind === "log") {
      const result = await logPageAs(
        userId,
        item.bookId,
        { page: item.page, day: item.day, value: item.value, minutes: item.minutes, clientId: item.id },
        { at },
      );
      return "error" in result
        ? { id: item.id, ok: false, error: result.error }
        : { id: item.id, ok: true, message: result.message };
    }
    const result = await moveFromReadingAs(userId, item.bookId, item.to, item.minutes, { at });
    if ("error" in result) return { id: item.id, ok: false, error: result.error };
    return "already" in result
      ? { id: item.id, ok: true, message: result.message }
      : { id: item.id, ok: true, message: result.message, undo: result.undo };
  } catch (err) {
    console.error("Couldn't sync a saved log:", err);
    return { id: item.id, ok: false, error: SERVER_FAILED, retry: true };
  }
}

/** Writes each item in turn, oldest first, and answers for each. */
export async function syncItems(
  userId: string,
  body: unknown,
): Promise<{ results: SyncResult[] } | { error: string }> {
  const items = body && typeof body === "object" ? (body as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return { error: "Expected a list of items" };
  if (items.length > MAX_SYNC_ITEMS) return { error: `At most ${MAX_SYNC_ITEMS} at a time` };
  const results: SyncResult[] = [];
  // One at a time: a later page of the same book has to find the earlier
  // one already in the log.
  for (const item of items) results.push(await syncOne(userId, item));
  return { results };
}
