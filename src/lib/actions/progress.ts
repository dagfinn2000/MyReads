"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";

/** Delete a progress log entry (ownership checked through the book). */
export async function deleteProgressEntry(entryId: string): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.progressEntry.findFirst({
    where: { id: entryId, book: { userId } },
    select: { bookId: true },
  });
  if (!existing) return;

  await prisma.progressEntry.delete({ where: { id: entryId } });

  revalidatePath(`/books/${existing.bookId}`);
  revalidatePath("/stats");
}
