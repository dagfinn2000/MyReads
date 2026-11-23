"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/actions/helpers";
import { forgetBooks, restoreBooks } from "@/lib/recently-deleted";

const idsSchema = z.array(z.string().min(1).max(64)).min(1).max(10_000);

function refresh() {
  revalidatePath("/books");
  revalidatePath("/stats");
  revalidatePath("/quotes");
  revalidatePath("/reading");
}

/** Puts books from Recently deleted back in the library, as they were. */
export async function restoreDeletedBooks(ids: string[]): Promise<{ count?: number; error?: string }> {
  const userId = await requireUserId();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { error: "Nothing to put back" };
  const result = await restoreBooks(userId, parsed.data);
  if (result.restored > 0) refresh();
  return result.error ? { count: result.restored, error: result.error } : { count: result.restored };
}

/** Deletes books in Recently deleted for good, now. */
export async function forgetDeletedBooks(ids: string[]): Promise<{ count?: number; error?: string }> {
  const userId = await requireUserId();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { error: "Nothing to delete" };
  const count = await forgetBooks(userId, parsed.data);
  revalidatePath("/books/deleted");
  return { count };
}

/** Empties Recently deleted: every book in it goes for good. */
export async function emptyRecentlyDeleted(): Promise<{ count?: number; error?: string }> {
  const userId = await requireUserId();
  const count = await forgetBooks(userId);
  revalidatePath("/books/deleted");
  return { count };
}
