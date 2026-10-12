"use server";

import { revalidatePath } from "next/cache";
import { BookOwnership } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/helpers";

const setOwnershipSchema = z.object({
  bookId: z.string().min(1).max(100),
  ownership: z.nativeEnum(BookOwnership),
});

/**
 * Change only a book's ownership: "I bought it" on the Do I own this? page,
 * where sending the whole book form back would be overkill.
 */
export async function setOwnership(
  bookId: string,
  ownership: BookOwnership,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = setOwnershipSchema.safeParse({ bookId, ownership });
  if (!parsed.success) return { error: "Invalid input" };

  const { count } = await prisma.book.updateMany({
    where: { id: parsed.data.bookId, userId },
    data: { ownership: parsed.data.ownership },
  });
  if (count === 0) return { error: "Book not found" };

  revalidatePath("/books");
  revalidatePath(`/books/${parsed.data.bookId}`);
  return { success: true };
}
