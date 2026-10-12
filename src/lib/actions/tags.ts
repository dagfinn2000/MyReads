"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import {
  TAG_RULE_MAX,
  cleanPreferencesPatch,
  normalizeRuleTag,
  parsePreferences,
} from "@/lib/preferences";
import {
  withRenameRule,
  withSkipRule,
  withoutRule,
  type TagRules,
} from "@/lib/tag-rules";

export interface TagActionResult {
  error?: string;
  /** Number of books whose tags changed. */
  count?: number;
  /** A rule for future imports was stored (renameTag's remember,
   *  deleteTag's neverImport). */
  ruleSaved?: boolean;
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

// Anything unexpected reads as "no options", so the rename still happens.
const renameOptions = z.object({ remember: z.boolean().optional() }).optional().catch(undefined);
const deleteOptions = z.object({ neverImport: z.boolean().optional() }).optional().catch(undefined);

/**
 * Changes the user's rules for imported subjects (Preferences, New books).
 * The row is locked while it is read and written, so two quick rule edits
 * can't each start from the same list and drop the other's change; the
 * write is the same jsonb merge as savePreferences, so other settings are
 * untouched.
 */
async function editTagRules(userId: string, change: (rules: TagRules) => TagRules) {
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ preferences: unknown }[]>`
      SELECT "preferences" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!row) return;
    const prefs = parsePreferences(row.preferences);
    const next = change({ renames: prefs.tagRenames, skips: prefs.tagSkips });
    const clean = cleanPreferencesPatch({ tagRenames: next.renames, tagSkips: next.skips });
    await tx.$executeRaw`
      UPDATE "User"
      SET "preferences" = COALESCE("preferences", '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb
      WHERE "id" = ${userId}`;
  });
}

/**
 * Renames a tag on every book that carries it. Renaming to a tag that
 * already exists merges the two (the array is deduped per book). With
 * `remember`, catalogue subjects by the old name are imported under the
 * new one from now on, even if no book carried it yet.
 */
export async function renameTag(
  from: string,
  to: string,
  options?: { remember?: boolean },
): Promise<TagActionResult> {
  const userId = await requireUserId();
  const source = normalizeTag(from);
  const target = normalizeTag(to);
  if (!source || !target) return { error: "Tag name is required" };
  if (target.length > TAG_RULE_MAX) return { error: "Tag must be at most 50 characters" };
  // The book form splits tags on commas, so one with a comma in it would
  // come apart the next time the book is saved.
  if (target.includes(",")) return { error: "Tags can't contain commas." };
  if (source === target) return { count: 0 };
  // A tag too long to be a rule (an old import) is still renamed on books.
  const remember =
    renameOptions.parse(options)?.remember === true && normalizeRuleTag(source) !== null;

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
  if (remember) await editTagRules(userId, (rules) => withRenameRule(rules, source, target));

  revalidatePath("/books");
  revalidatePath("/stats");
  return { count: books.length, ...(remember && { ruleSaved: true }) };
}

/**
 * Removes a tag from every book that carries it. Books are untouched
 * otherwise. With `neverImport`, catalogue subjects by that name are left
 * out of future imports.
 */
export async function deleteTag(
  name: string,
  options?: { neverImport?: boolean },
): Promise<TagActionResult> {
  const userId = await requireUserId();
  const tag = normalizeTag(name);
  if (!tag) return { error: "Tag name is required" };
  const neverImport =
    deleteOptions.parse(options)?.neverImport === true && normalizeRuleTag(tag) !== null;

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
  if (neverImport) await editTagRules(userId, (rules) => withSkipRule(rules, tag));

  revalidatePath("/books");
  revalidatePath("/stats");
  return { count: books.length, ...(neverImport && { ruleSaved: true }) };
}

const ruleSchema = z
  .object({
    from: z.string().max(200).optional(),
    skip: z.string().max(200).optional(),
  })
  .refine((r) => r.from !== undefined || r.skip !== undefined);

/**
 * Removes one rule for future imports (the Tag rules list in Preferences):
 * the rename of `from`, or the skip of `skip`. Through the same locked edit
 * as the tag actions, so a rule another tab has just added survives.
 */
export async function removeTagRule(rule: {
  from?: string;
  skip?: string;
}): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = ruleSchema.safeParse(rule);
  if (!parsed.success) return { error: "Invalid input" };

  await editTagRules(userId, (rules) =>
    withoutRule(rules, {
      from: parsed.data.from && normalizeTag(parsed.data.from),
      skip: parsed.data.skip && normalizeTag(parsed.data.skip),
    }),
  );

  // The list lives on the Account page.
  revalidatePath("/account");
  return {};
}
