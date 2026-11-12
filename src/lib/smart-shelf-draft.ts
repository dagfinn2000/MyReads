import { z } from "zod";

/**
 * A smart shelf whose rules are being chosen: a new one (a name, and no id
 * yet) or one being changed. Kept in a cookie while the reader sets the
 * library's filters, so every link the library draws can stay as it is and
 * the bar saying what's being made still shows after any of them. Saving
 * or cancelling clears it; left alone it lapses in a day.
 */
export const DRAFT_COOKIE = "myreads-smart-shelf";
export const DRAFT_MAX_AGE = 24 * 60 * 60;

export interface SmartShelfDraft {
  /** The shelf being changed, or null for a new one. */
  id: string | null;
  name: string;
}

const draftSchema = z.object({
  id: z.string().min(1).max(64).nullable(),
  name: z.string().trim().min(1).max(50),
});

/** The cookie's value as a draft, or null for anything else. */
export function parseDraft(value: string | undefined): SmartShelfDraft | null {
  if (!value || value.length > 500) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeDraft(draft: SmartShelfDraft): string {
  return JSON.stringify({ id: draft.id, name: draft.name });
}
