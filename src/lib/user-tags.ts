import { prisma } from "@/lib/prisma";
import type { Preferences } from "@/lib/preferences";
import type { TagImportSettings } from "@/lib/tag-rules";

/** Every tag used anywhere in the user's library, once each. Aggregated in
 *  SQL like the library page's tag list (books/page.tsx). */
export async function userTagNames(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT t AS tag
    FROM "Book", LATERAL unnest("tags") AS t
    WHERE "userId" = ${userId}`;
  return rows.map((r) => r.tag);
}

/** How catalogue subjects become tags for this user (Preferences, New
 *  books). The library's tags are only read when the mode needs them. */
export async function tagImportFor(
  userId: string,
  prefs: Preferences,
): Promise<TagImportSettings> {
  return {
    mode: prefs.importTagsMode,
    rules: { renames: prefs.tagRenames, skips: prefs.tagSkips },
    knownTags: prefs.importTagsMode === "known" ? await userTagNames(userId) : [],
  };
}
