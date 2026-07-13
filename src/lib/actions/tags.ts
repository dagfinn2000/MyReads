"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface TagActionResult {
  error?: string;
  /** Number of books whose tags changed. */
  count?: number;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Renames a tag on every book that carries it. Renaming to a tag that
 * already exists merges the two (the array is deduped per book).
 */
export async function renameTag(
  from: string,
  to: string,
): Promise<TagActionResult> {
  const userId = await requireUserId();
  const source = normalizeTag(from);
  const target = normalizeTag(to);
  if (!source || !target) return { error: "Tag name is required" };
  if (target.length > 50) return { error: "Tag must be at most 50 characters" };
  if (source === target) return { count: 0 };

  const books = await prisma.book.findMany({
    where: { userId, tags: { has: source } },
    select: { id: true, tags: true },
  });

  await prisma.$transaction(
    books.map((b) =>
      prisma.book.update({
        where: { id: b.id },
        data: {
          tags: [...new Set(b.tags.map((t) => (t === source ? target : t)))],
        },
      }),
    ),
  );

  revalidatePath("/books");
  revalidatePath("/stats");
  return { count: books.length };
}

/** Removes a tag from every book that carries it. Books are untouched otherwise. */
export async function deleteTag(name: string): Promise<TagActionResult> {
  const userId = await requireUserId();
  const tag = normalizeTag(name);
  if (!tag) return { error: "Tag name is required" };

  const books = await prisma.book.findMany({
    where: { userId, tags: { has: tag } },
    select: { id: true, tags: true },
  });

  await prisma.$transaction(
    books.map((b) =>
      prisma.book.update({
        where: { id: b.id },
        data: { tags: b.tags.filter((t) => t !== tag) },
      }),
    ),
  );

  revalidatePath("/books");
  revalidatePath("/stats");
  return { count: books.length };
}
