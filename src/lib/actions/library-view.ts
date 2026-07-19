"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { parseLibraryView } from "@/lib/library-view";

/**
 * Remember the library view (sort/dir/group) on the account, so the chosen
 * sort survives navigating away and follows the user across browsers.
 * Fire-and-forget from the filter bar; parseLibraryView clamps anything
 * invalid back to defaults rather than erroring.
 */
export async function saveLibraryView(view: {
  sort: string;
  dir: string;
  group: string;
}): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { libraryView: parseLibraryView(view) },
  });
}
