"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const goalSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  target: z.coerce.number().int().min(0).max(10000),
});

/**
 * Sets (or clears, with target 0 / empty) the reading goal for a year.
 * Plain server action used directly as a <form action> on the stats page.
 */
export async function setReadingGoal(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const parsed = goalSchema.safeParse({
    year: formData.get("year"),
    // An emptied number input submits "" — treat it as clearing the goal.
    target: formData.get("target") || 0,
  });
  if (!parsed.success) return;
  const { year, target } = parsed.data;

  if (target === 0) {
    await prisma.readingGoal.deleteMany({ where: { userId, year } });
  } else {
    await prisma.readingGoal.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, target },
      update: { target },
    });
  }

  revalidatePath("/stats");
}
