"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { idSchema } from "@/lib/reading-log-input";
import { challengesOnShelf } from "@/lib/shelf-references";
import { DRAFT_COOKIE, DRAFT_MAX_AGE, serializeDraft } from "@/lib/smart-shelf-draft";
import { MAX_SMART_SHELVES, rulesShelfId, smartRulesQuery } from "@/lib/smart-shelves";
import { equalsIgnoringCase } from "@/lib/utils";
import { shelfNameSchema } from "@/lib/validation";

/**
 * Smart shelves (lib/smart-shelves.ts): made from the library's filters,
 * renamed, given new rules, deleted. A name is checked against shelves of
 * both kinds, in any case, the way a new shelf's is.
 */

type Result = { error?: string; id?: string };

function revalidate() {
  revalidatePath("/books", "layout");
  revalidatePath("/stats");
  revalidatePath("/account");
}

/** The reader's shelf or smart shelf already called `name`, as an error. */
async function nameTaken(userId: string, name: string, exceptId?: string): Promise<string | null> {
  const [shelf, smart] = await Promise.all([
    prisma.shelf.findFirst({ where: { userId, name: equalsIgnoringCase(name) }, select: { name: true } }),
    prisma.smartShelf.findFirst({
      where: { userId, name: equalsIgnoringCase(name), ...(exceptId && { id: { not: exceptId } }) },
      select: { name: true },
    }),
  ]);
  if (shelf) return `You already have a shelf called “${shelf.name}”.`;
  if (smart) return `You already have a smart shelf called “${smart.name}”.`;
  return null;
}

/**
 * The rules a library address's filters make, checked: at least one
 * filter, and a shelf among them only if it's one of the reader's own (a
 * smart shelf built on another could go round in circles).
 */
async function checkedRules(
  userId: string,
  query: unknown,
): Promise<{ rules: string } | { error: string }> {
  const rules = smartRulesQuery(typeof query === "string" ? query.slice(0, 4000) : "");
  if (!rules) return { error: "Pick a filter or two first: these would be every book you have." };
  const shelfId = rulesShelfId(rules);
  if (shelfId) {
    const [shelf, smart] = await Promise.all([
      prisma.shelf.findFirst({ where: { id: shelfId, userId }, select: { id: true } }),
      prisma.smartShelf.findFirst({ where: { id: shelfId, userId }, select: { id: true } }),
    ]);
    if (smart) {
      return { error: "A smart shelf can't take its books from another smart shelf. Pick one of your own shelves, or none." };
    }
    if (!shelf) return { error: "The shelf in these filters is gone. Pick another, or none." };
  }
  return { rules };
}

async function clearDraft() {
  (await cookies()).delete(DRAFT_COOKIE);
}

/** Makes a smart shelf from the filters in `query` (a library address). */
export async function createSmartShelf(name: string, query: string): Promise<Result> {
  const userId = await requireUserId();
  const parsed = shelfNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const checked = await checkedRules(userId, query);
  if ("error" in checked) return checked;
  const taken = await nameTaken(userId, parsed.data);
  if (taken) return { error: taken };
  if ((await prisma.smartShelf.count({ where: { userId } })) >= MAX_SMART_SHELVES) {
    return { error: `You can keep up to ${MAX_SMART_SHELVES} smart shelves.` };
  }

  try {
    const shelf = await prisma.smartShelf.create({
      data: { userId, name: parsed.data, rules: checked.rules },
      select: { id: true },
    });
    await clearDraft();
    revalidate();
    return { id: shelf.id };
  } catch (err) {
    // Made under this name from another tab a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `You already have a smart shelf called “${parsed.data}”.` };
    }
    throw err;
  }
}

/** Gives a smart shelf the filters in `query` as its new rules. */
export async function updateSmartShelfRules(id: string, query: string): Promise<Result> {
  const userId = await requireUserId();
  if (!idSchema.safeParse(id).success) return { error: "Smart shelf not found" };
  const shelf = await prisma.smartShelf.findFirst({ where: { id, userId }, select: { id: true } });
  if (!shelf) return { error: "That smart shelf is gone." };
  const checked = await checkedRules(userId, query);
  if ("error" in checked) return checked;
  if (rulesShelfId(checked.rules) === id) {
    return { error: "A smart shelf can't take its books from itself." };
  }

  await prisma.smartShelf.update({ where: { id, userId }, data: { rules: checked.rules } });
  await clearDraft();
  revalidate();
  return { id };
}

/** Renames a smart shelf. A name either kind of shelf has is refused. */
export async function renameSmartShelf(
  id: string,
  name: string,
): Promise<{ error?: string; name?: string }> {
  const userId = await requireUserId();
  if (!idSchema.safeParse(id).success) return { error: "Smart shelf not found" };
  const parsed = shelfNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const shelf = await prisma.smartShelf.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });
  if (!shelf) return { error: "Smart shelf not found" };
  if (shelf.name === parsed.data) return { name: shelf.name };
  const taken = await nameTaken(userId, parsed.data, id);
  if (taken) return { error: taken };

  try {
    await prisma.smartShelf.update({ where: { id, userId }, data: { name: parsed.data } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `You already have a smart shelf called “${parsed.data}”.` };
    }
    throw err;
  }
  revalidate();
  return { name: parsed.data };
}

/**
 * Deletes a smart shelf. No book changes, as none was ever put on it; a
 * challenge counting its books goes too, with nothing left to count.
 */
export async function deleteSmartShelf(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!idSchema.safeParse(id).success) return;
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.smartShelf.deleteMany({ where: { id, userId } });
    if (count === 0) return;
    const gone = await challengesOnShelf(tx, userId, id);
    if (gone.length > 0) {
      await tx.challenge.deleteMany({ where: { id: { in: gone.map((c) => c.id) }, userId } });
    }
  });
  revalidate();
}

/**
 * Starts choosing a smart shelf's rules in the library: for a new shelf
 * (`name`, checked now so a taken one is said straight away) or for an
 * existing one (`id`, whose rules come back to be put in the address).
 */
export async function startSmartShelfDraft(input: {
  id?: string;
  name?: string;
}): Promise<{ error?: string; rules?: string }> {
  const userId = await requireUserId();
  const jar = await cookies();
  const set = (id: string | null, name: string) =>
    jar.set(DRAFT_COOKIE, serializeDraft({ id, name }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DRAFT_MAX_AGE,
    });

  if (input.id !== undefined) {
    if (!idSchema.safeParse(input.id).success) return { error: "Smart shelf not found" };
    const shelf = await prisma.smartShelf.findFirst({
      where: { id: input.id, userId },
      select: { id: true, name: true, rules: true },
    });
    if (!shelf) return { error: "That smart shelf is gone." };
    set(shelf.id, shelf.name);
    return { rules: shelf.rules };
  }

  const parsed = shelfNameSchema.safeParse(input.name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const taken = await nameTaken(userId, parsed.data);
  if (taken) return { error: taken };
  if ((await prisma.smartShelf.count({ where: { userId } })) >= MAX_SMART_SHELVES) {
    return { error: `You can keep up to ${MAX_SMART_SHELVES} smart shelves.` };
  }
  set(null, parsed.data);
  return {};
}

/** Stops choosing rules: the shelf stays as it was, or isn't made. */
export async function cancelSmartShelfDraft(): Promise<void> {
  await requireUserId();
  await clearDraft();
}
