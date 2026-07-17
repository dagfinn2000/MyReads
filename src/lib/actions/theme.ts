"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { THEMES } from "@/lib/themes";

/**
 * Remember the picked theme on the user's account, so any browser they sign
 * in from gets it server-rendered on first paint. Signed-out picks (the
 * login page has the picker too) stay localStorage-only — deliberately not
 * requireUserId, which would throw.
 */
export async function saveTheme(themeId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  if (!THEMES.some((t) => t.id === themeId)) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: themeId },
  });
}
