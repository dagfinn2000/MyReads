"use client";

import { useActionState } from "react";
import type { GoalUnit } from "@prisma/client";
import { setReadingGoal, type GoalFormState } from "@/lib/actions/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Set, change or remove (0) the goal for one year. Keyed by year where it's
 * used, so switching years starts afresh.
 */
export function GoalForm({
  year,
  currentYear,
  goal,
}: {
  year: number;
  currentYear: number;
  goal: { target: number; unit: GoalUnit; countRereads: boolean } | null;
}) {
  const [state, formAction, pending] = useActionState(
    (_prev: GoalFormState, formData: FormData) => setReadingGoal(formData),
    {},
  );

  // Remount the fields when the saved goal changes: React resets a form
  // after its action, and the unit Select's hidden native select would go
  // back to its mount-time value (see reading-card.tsx).
  const formKey = [goal?.target ?? 0, goal?.unit ?? "", goal?.countRereads ?? ""].join("|");

  const message = state.error
    ? state.error
    : state.saved?.removed
      ? "Goal removed."
      : state.saved
        ? state.saved.year > currentYear
          ? "Saved. This year's goal is unchanged."
          : "Saved."
        : "";

  return (
    <div className="grid gap-1">
      <form key={formKey} action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="year" value={year} />
        <div className="grid gap-1">
          <label htmlFor="goal-target" className="text-xs text-muted-foreground">
            Goal for {year}
          </label>
          <Input
            id="goal-target"
            name="target"
            type="number"
            min={0}
            max={1000000}
            defaultValue={goal?.target}
            placeholder="24"
            className="w-28"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Counting</span>
          <Select name="unit" defaultValue={goal?.unit ?? "BOOKS"}>
            <SelectTrigger className="w-28" aria-label="What the goal counts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BOOKS">Books</SelectItem>
              <SelectItem value="PAGES">Pages</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="countRereads"
            defaultChecked={goal?.countRereads ?? true}
            className="size-4 accent-primary"
          />
          Count re-reads
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : goal ? "Update goal" : "Set goal"}
        </Button>
        {goal && (
          <span className="pb-2 text-xs text-muted-foreground">Set to 0 to remove the goal.</span>
        )}
      </form>
      <p
        aria-live="polite"
        className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {message}
      </p>
    </div>
  );
}
