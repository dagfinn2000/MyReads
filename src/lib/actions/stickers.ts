"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { cleanStickers } from "@/lib/stickers";
import { idSchema } from "@/lib/reading-log-input";

/**
 * Sets the stickers pinned on a book's cover (the sticker picker on its
 * page), in the order given. Only known stickers are kept, each once; the
 * book must be the reader's. Returns what was saved, or null when nothing
 * could be.
 */
export async function setBookStickers(bookId: unknown, stickers: unknown): Promise<string[] | null> {
  const userId = await requireUserId();
  // Server-action arguments arrive as whatever the client sent.
  if (!idSchema.safeParse(bookId).success || !Array.isArray(stickers) || stickers.length > 100) {
    return null;
  }
  const clean = cleanStickers(stickers);
  const { count } = await prisma.book.updateMany({
    where: { id: bookId as string, userId },
    data: { stickers: clean },
  });
  if (count === 0) return null;

  revalidatePath(`/books/${bookId}`);
  revalidatePath("/books");
  return clean;
}
