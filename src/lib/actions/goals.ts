"use server";

import { revalidatePath } from "next/cache";
import { GoalSpan, GoalUnit } from "@/lib/enums";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/helpers";
import { maxGoalDays } from "@/lib/goals";

const goalSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  // A pages goal runs into the thousands, so the cap is far above any
  // sensible book count.
  target: z.coerce.number().int().min(0).max(1_000_000),
  unit: z.enum(GoalUnit).catch(GoalUnit.BOOKS),
  span: z.enum(GoalSpan).catch(GoalSpan.YEAR),
  countRereads: z.boolean(),
});

/** What the goal form shows after a save. */
export interface GoalFormState {
  error?: string;
  saved?: { year: number; removed: boolean };
}

/**
 * Sets (or clears, with target 0 / empty) the reading goal for a year, or
 * for each month of it, along with what it counts: books, pages or reading
 * days, with or without re-reads. Any year can be saved, so next year's
 * goal can be set in December and a past one corrected; each year's goal
 * and monthly goal is its own row.
 */
export async function setReadingGoal(formData: FormData): Promise<GoalFormState> {
  const userId = await requireUserId();

  const parsed = goalSchema.safeParse({
    year: formData.get("year"),
    // An emptied number input submits "" — treat it as clearing the goal.
    target: formData.get("target") || 0,
    unit: formData.get("unit"),
    span: formData.get("span"),
    // An unticked checkbox submits nothing at all.
    countRereads: formData.get("countRereads") === "on",
  });
  if (!parsed.success) return { error: "Enter a whole number from 0 to 1,000,000." };
  const { year, target, unit, span, countRereads } = parsed.data;
  // A month has at most 31 reading days, and a year 365 or 366.
  const maxDays = maxGoalDays(year, span);
  if (unit === GoalUnit.DAYS && target > maxDays) {
    return {
      error:
        span === GoalSpan.MONTH
          ? `A month has at most ${maxDays} days.`
          : `${year} has ${maxDays} days.`,
    };
  }

  if (target === 0) {
    await prisma.readingGoal.deleteMany({ where: { userId, year, span } });
  } else {
    await prisma.readingGoal.upsert({
      where: { userId_year_span: { userId, year, span } },
      create: { userId, year, span, target, unit, countRereads },
      update: { target, unit, countRereads },
    });
  }

  revalidatePath("/stats");
  revalidatePath(`/stats/year/${year}`);
  return { saved: { year, removed: target === 0 } };
}
