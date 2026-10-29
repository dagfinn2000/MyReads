"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { cleanLibraryViewPatch, type LibraryView } from "@/lib/library-view";

/**
 * Remember part of the library view on the account — the sort, or how the
 * cards look — so it survives navigating away and follows the user across
 * browsers. Only the fields given change: the filter bar saves sort changes
 * and the View menu saves display changes, and neither may undo the other.
 * The merge happens in the database for the same reason as savePreferences.
 * Invalid values are clamped back to defaults rather than erroring. Says
 * whether anything was written.
 */
async function writeLibraryView(patch: Partial<Record<keyof LibraryView, unknown>>): Promise<boolean> {
  const userId = await requireUserId();
  const clean = cleanLibraryViewPatch(patch);
  if (Object.keys(clean).length === 0) return false;
  await prisma.$executeRaw`
    UPDATE "User"
    SET "libraryView" = COALESCE("libraryView", '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb
    WHERE "id" = ${userId}`;
  return true;
}

/**
 * The filter bar's sort, direction and grouping. They are already in the
 * address the bar goes to, so nothing needs drawing again. Revalidating
 * here had the server draw the whole app again in this action's reply, the
 * library wait for that rather than its own navigation, and every link's
 * prefetch thrown away.
 */
export async function rememberLibraryView(patch: Partial<Record<keyof LibraryView, unknown>>): Promise<void> {
  await writeLibraryView(patch);
}

/**
 * The View menu: the cards are drawn from the saved view, so this action's
 * reply brings the page drawn again (refresh(): the page's own data only,
 * prefetched links kept).
 */
export async function saveLibraryView(patch: Partial<Record<keyof LibraryView, unknown>>): Promise<void> {
  if (await writeLibraryView(patch)) refresh();
}
