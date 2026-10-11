"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

/**
 * Remember the picked theme on the user's account, so any browser they sign
 * in from gets it server-rendered on first paint. Takes a theme id or an
 * automatic "auto:<light>:<dark>" pair (see ThemeSetting). Signed-out picks
 * (the login page has the picker too) stay localStorage-only — deliberately
 * not requireUserId, which would throw.
 */
export async function saveTheme(value: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const setting = parseThemeSetting(value);
  if (!setting) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: serializeThemeSetting(setting) },
  });
}
