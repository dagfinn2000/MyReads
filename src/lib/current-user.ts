import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseLibraryView, type LibraryView } from "@/lib/library-view";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  serverTimeZone,
  type Preferences,
} from "@/lib/preferences";

/**
 * The signed-in user's id plus the bits the shell needs, fetched once per
 * request.
 *
 * Rendering any page previously resolved the session twice — once in the root
 * layout to look up the theme, once in the page itself — and issued a
 * separate query for the theme on top. React's `cache` memoizes per request,
 * so the layout and the page now share one session resolution and one row
 * read.
 *
 * That also absorbs the cost of session revocation: the `jwt` callback reads
 * the user row to check `tokenVersion`, and folding the theme and
 * preferences into the same request-scoped lookup keeps a page render at one
 * user query rather than three.
 */
export const getCurrentUser = cache(
  async (): Promise<{
    id: string;
    theme: string | null;
    /** As stored: `timeZone` is "" until the reader's zone is known. */
    preferences: Preferences;
    /** For the 3D covers switch, which the root layout applies everywhere. */
    libraryView: LibraryView;
    /** For the backup reminder the shell shows. */
    lastBackupAt: Date | null;
  } | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, theme: true, preferences: true, libraryView: true, lastBackupAt: true },
    });
    if (!user) return null;
    return {
      ...user,
      preferences: parsePreferences(user.preferences),
      libraryView: parseLibraryView(user.libraryView),
    };
  },
);

/**
 * The signed-in user's preferences, ready to use: defaults when signed out,
 * and `timeZone` always set — to the server's zone until the reader's own
 * is known — so date code never has to handle "no zone".
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const prefs = (await getCurrentUser())?.preferences ?? DEFAULT_PREFERENCES;
  return { ...prefs, timeZone: prefs.timeZone || serverTimeZone() };
});
