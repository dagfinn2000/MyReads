"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { cleanLibraryViewPatch, type LibraryView } from "@/lib/library-view";

/**
 * Remember part of the library view on the account — the sort, or how the
 * cards look — so it survives navigating away and follows the user across
 * browsers. Only the fields given change: the filter bar saves sort changes
 * and the View menu saves display changes, and neither may undo the other.
 * The merge happens in the database for the same reason as savePreferences.
 * Invalid values are clamped back to defaults rather than erroring.
 */
export async function saveLibraryView(patch: Partial<Record<keyof LibraryView, unknown>>): Promise<void> {
  const userId = await requireUserId();
  const clean = cleanLibraryViewPatch(patch);
  if (Object.keys(clean).length === 0) return;
  await prisma.$executeRaw`
    UPDATE "User"
    SET "libraryView" = COALESCE("libraryView", '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb
    WHERE "id" = ${userId}`;
  revalidatePath("/books");
}
