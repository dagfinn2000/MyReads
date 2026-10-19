"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReadingStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";

/**
 * The reader's own Up next list (Book.upNextRank): added to from a Want to
 * Read book's page or Now reading, put in order and taken off there.
 * Starting a book takes it off by itself (lib/actions/books.ts, bulk.ts).
 */

const idSchema = z.string().min(1).max(100);
const orderSchema = z.array(idSchema).max(1000);

function revalidateUpNext(bookId?: string) {
  revalidatePath("/reading");
  if (bookId) revalidatePath(`/books/${bookId}`);
}

/** Put a Want to Read book at the end of the list. */
export async function addToUpNext(bookId: unknown): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return { error: "Book not found" };
  const book = await prisma.book.findFirst({
    where: { id: id.data, userId },
    select: { status: true, upNextRank: true },
  });
  if (!book) return { error: "Book not found" };
  if (book.status !== ReadingStatus.WANT_TO_READ) {
    return { error: "Only Want to Read books go on Up next" };
  }
  if (book.upNextRank === null) {
    const last = await prisma.book.aggregate({ where: { userId }, _max: { upNextRank: true } });
    await prisma.book.update({
      where: { id: id.data },
      data: { upNextRank: (last._max.upNextRank ?? 0) + 1 },
    });
  }
  revalidateUpNext(id.data);
  return {};
}

/** Take a book off the list. */
export async function removeFromUpNext(bookId: unknown): Promise<void> {
  const userId = await requireUserId();
  const id = idSchema.safeParse(bookId);
  if (!id.success) return;
  await prisma.book.updateMany({ where: { id: id.data, userId }, data: { upNextRank: null } });
  revalidateUpNext(id.data);
}

/**
 * The whole list in its new order, as Now reading's editor saves it after
 * each move: these books in this order, and nothing else on the list. Ids
 * that aren't the reader's Want to Read books are passed over.
 */
export async function setUpNextOrder(bookIds: unknown): Promise<void> {
  const userId = await requireUserId();
  const parsed = orderSchema.safeParse(bookIds);
  if (!parsed.success) return;
  const ids = [...new Set(parsed.data)];
  await prisma.$transaction([
    prisma.book.updateMany({
      where: { userId, upNextRank: { not: null }, id: { notIn: ids } },
      data: { upNextRank: null },
    }),
    ...ids.map((id, i) =>
      prisma.book.updateMany({
        where: { id, userId, status: ReadingStatus.WANT_TO_READ },
        data: { upNextRank: i + 1 },
      }),
    ),
  ]);
  revalidateUpNext();
}
