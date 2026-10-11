"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { cleanPreferencesPatch, type Preferences } from "@/lib/preferences";

/**
 * Saves some preferences on the account. Only the keys in `patch` change.
 *
 * The merge happens in the database (`||` on jsonb) rather than as a read,
 * merge and write here: the Preferences card saves every change as it's
 * made, and two quick changes would otherwise race, with the second write
 * putting back the value the first one just replaced.
 */
export async function savePreferences(patch: Partial<Preferences>): Promise<void> {
  const userId = await requireUserId();
  const clean = cleanPreferencesPatch(patch);
  if (Object.keys(clean).length === 0) return;

  await prisma.$executeRaw`
    UPDATE "User"
    SET "preferences" = COALESCE("preferences", '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb
    WHERE "id" = ${userId}`;

  // Preferences show up on every page (dates, ratings, the nav, text size),
  // so the whole app is stale after a change.
  revalidatePath("/", "layout");
}
