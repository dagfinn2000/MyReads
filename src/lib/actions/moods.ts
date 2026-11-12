"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { getPreferences } from "@/lib/current-user";
import { cleanBookMoods } from "@/lib/moods";
import { idSchema } from "@/lib/reading-log-input";

/**
 * Sets a book's moods (the mood picker on its page). Only moods the reader
 * has are kept, each once; the book must be theirs. Returns what was
 * saved, or null when nothing could be.
 */
export async function setBookMoods(bookId: unknown, moods: unknown): Promise<string[] | null> {
  const userId = await requireUserId();
  // Server-action arguments arrive as whatever the client sent.
  if (!idSchema.safeParse(bookId).success || !Array.isArray(moods) || moods.length > 100) {
    return null;
  }
  const prefs = await getPreferences();
  const clean = cleanBookMoods(moods, prefs);
  const { count } = await prisma.book.updateMany({
    where: { id: bookId as string, userId },
    data: { moods: clean },
  });
  if (count === 0) return null;

  revalidatePath(`/books/${bookId}`);
  revalidatePath("/books");
  revalidatePath("/stats");
  return clean;
}
