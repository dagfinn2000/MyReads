"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import {
  MAX_SAVED_VIEWS,
  SAVED_VIEW_NAME_MAX,
  canonicalViewQueryFromString,
} from "@/lib/saved-views";

const nameSchema = z.string().trim().min(1).max(SAVED_VIEW_NAME_MAX);

/**
 * Saves the library view on screen under a name. Saving under a name that
 * already exists replaces that view — the natural way to update one.
 */
export async function saveView(
  name: string,
  query: string,
): Promise<{ error?: string; id?: string }> {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: `Give the view a name (up to ${SAVED_VIEW_NAME_MAX} characters).` };
  }
  const canonical = canonicalViewQueryFromString(typeof query === "string" ? query : "");

  const existing = await prisma.savedView.findUnique({
    where: { userId_name: { userId, name: parsed.data } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.savedView.count({ where: { userId } });
    if (count >= MAX_SAVED_VIEWS) {
      return { error: `You can keep up to ${MAX_SAVED_VIEWS} saved views.` };
    }
  }

  const view = await prisma.savedView.upsert({
    where: { userId_name: { userId, name: parsed.data } },
    create: { userId, name: parsed.data, query: canonical },
    update: { query: canonical },
    select: { id: true },
  });
  revalidatePath("/books");
  revalidatePath("/account");
  return { id: view.id };
}

/**
 * Renames a saved view. Names are unique per account exactly as typed (as
 * saving treats them), so another view's name is refused rather than
 * merged: two views can hold different filters.
 */
export async function renameView(id: string, name: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!z.string().min(1).max(64).safeParse(id).success) return { error: "View not found" };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: `Give the view a name (up to ${SAVED_VIEW_NAME_MAX} characters).` };
  }
  const newName = parsed.data;

  const view = await prisma.savedView.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });
  if (!view) return { error: "View not found" };
  if (view.name === newName) return {};

  const taken = { error: `You already have a view called “${newName}”.` };
  const clash = await prisma.savedView.findUnique({
    where: { userId_name: { userId, name: newName } },
    select: { id: true },
  });
  if (clash) return taken;

  try {
    await prisma.savedView.update({ where: { id: view.id, userId }, data: { name: newName } });
  } catch (err) {
    // Saved under that name from another tab a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return taken;
    throw err;
  }
  revalidatePath("/books");
  revalidatePath("/account");
  return {};
}

/** Deletes a saved view. If the library opened on it, it opens on the plain
 *  library again. */
export async function deleteView(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.savedView.deleteMany({ where: { id, userId } });
  await prisma.$executeRaw`
    UPDATE "User"
    SET "preferences" = "preferences" || '{"defaultViewId": ""}'::jsonb
    WHERE "id" = ${userId} AND "preferences"->>'defaultViewId' = ${id}`;
  revalidatePath("/books");
  revalidatePath("/account");
}
