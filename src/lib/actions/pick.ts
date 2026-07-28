"use server";

import { ReadingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { buildBookWhere, parseFilters } from "@/lib/library-filters";

/**
 * Picks a random book from Want to Read within the current filters, falling
 * back to any filtered book when the view has no unread ones — the same rule
 * the button always used.
 *
 * It runs here rather than in the browser because the page no longer ships
 * the entire library to the client. Choosing from the loaded slice would
 * quietly turn "anything on my to-read shelf" into "anything in the first
 * couple of hundred", which is exactly the sort of silent narrowing a
 * shuffle button must not have.
 */
export async function pickRandomBook(
  searchParams: Record<string, string>,
): Promise<{ id: string } | null> {
  const userId = await requireUserId();
  const where = buildBookWhere(userId, parseFilters(searchParams));

  const pickFrom = async (status?: ReadingStatus) => {
    const rows = await prisma.book.findMany({
      where: status ? { ...where, status } : where,
      select: { id: true },
    });
    if (rows.length === 0) return null;
    return rows[Math.floor(Math.random() * rows.length)];
  };

  return (await pickFrom(ReadingStatus.WANT_TO_READ)) ?? (await pickFrom());
}
