"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import {
  CHALLENGE_NAME_MAX,
  CHALLENGE_TARGET_MAX,
  MAX_CHALLENGES,
  challengeQuery,
} from "@/lib/challenges";
import { idSchema } from "@/lib/reading-log-input";

const fieldsSchema = z.object({
  name: z.string().trim().max(CHALLENGE_NAME_MAX),
  target: z.coerce.number().int().min(1).max(CHALLENGE_TARGET_MAX),
  year: z.coerce.number().int().min(1900).max(2200),
});

export interface ChallengeFormState {
  error?: string;
  saved?: boolean;
}

/**
 * The slice of the library a menu choice means, as a query string: a saved
 * view's filters, one shelf, or one tag. Views and shelves are looked up in
 * the reader's own account. Null when it names nothing they have.
 */
async function sourceQuery(userId: string, source: string): Promise<string | null> {
  const [kind, ...rest] = source.split(":");
  const value = rest.join(":");
  if (kind === "view" && idSchema.safeParse(value).success) {
    const view = await prisma.savedView.findFirst({
      where: { id: value, userId },
      select: { query: true },
    });
    return view ? challengeQuery(view.query) : null;
  }
  if (kind === "shelf" && idSchema.safeParse(value).success) {
    const shelf = await prisma.shelf.findFirst({ where: { id: value, userId }, select: { id: true } });
    return shelf ? challengeQuery(new URLSearchParams({ shelfId: shelf.id }).toString()) : null;
  }
  if (kind === "tag" && value.trim() && value.length <= 100 && !value.includes(",")) {
    return challengeQuery(new URLSearchParams({ tag: value.trim() }).toString());
  }
  return null;
}

/** Start a challenge: so many books from a view, shelf or tag in a year. */
export async function createChallenge(
  _prev: ChallengeFormState,
  formData: FormData,
): Promise<ChallengeFormState> {
  const userId = await requireUserId();
  const fields = fieldsSchema.safeParse({
    name: formData.get("name") ?? "",
    target: formData.get("target"),
    year: formData.get("year"),
  });
  if (!fields.success) {
    return { error: `Pick how many books, from 1 to ${CHALLENGE_TARGET_MAX}.` };
  }
  const source = formData.get("source");
  const query = typeof source === "string" ? await sourceQuery(userId, source) : null;
  if (query === null) return { error: "Pick which books count." };

  const sourceName = String(formData.get("sourceName") ?? "").trim().slice(0, CHALLENGE_NAME_MAX);
  const name = fields.data.name || sourceName || "Challenge";
  if ((await prisma.challenge.count({ where: { userId } })) >= MAX_CHALLENGES) {
    return { error: `You can keep up to ${MAX_CHALLENGES} challenges.` };
  }

  await prisma.challenge.create({
    data: { userId, name, target: fields.data.target, year: fields.data.year, query },
  });
  revalidatePath("/stats");
  return { saved: true };
}

/** Change a challenge's name or target. */
export async function updateChallenge(
  id: string,
  name: string,
  target: number,
): Promise<string | undefined> {
  const userId = await requireUserId();
  const parsedId = idSchema.safeParse(id);
  const parsedName = z.string().trim().min(1).max(CHALLENGE_NAME_MAX).safeParse(name);
  const parsedTarget = z.number().int().min(1).max(CHALLENGE_TARGET_MAX).safeParse(target);
  if (!parsedId.success) return "Challenge not found";
  if (!parsedName.success) return "Give it a name.";
  if (!parsedTarget.success) return `Pick how many books, from 1 to ${CHALLENGE_TARGET_MAX}.`;

  const { count } = await prisma.challenge.updateMany({
    where: { id: parsedId.data, userId },
    data: { name: parsedName.data, target: parsedTarget.data },
  });
  if (count === 0) return "Challenge not found";
  revalidatePath("/stats");
}

export async function deleteChallenge(id: string): Promise<void> {
  const userId = await requireUserId();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return;
  await prisma.challenge.deleteMany({ where: { id: parsed.data, userId } });
  revalidatePath("/stats");
}
