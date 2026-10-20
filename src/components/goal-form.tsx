"use client";

import { useActionState, useState } from "react";
import type { GoalSpan, GoalUnit } from "@/lib/enums";
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
 * Set, change or remove (0) the goal for one year, or for each month of
 * it. Keyed by year where it's used, so switching years starts afresh.
 */
export function GoalForm({
  year,
  currentYear,
  span = "YEAR",
  goal,
}: {
  year: number;
  currentYear: number;
  span?: GoalSpan;
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
  const monthly = span === "MONTH";
  const id = monthly ? "goal-target-month" : "goal-target";

  const message = state.error
    ? state.error
    : state.saved?.removed
      ? "Goal removed."
      : state.saved
        ? state.saved.year > currentYear && !monthly
          ? "Saved. This year's goal is unchanged."
          : "Saved."
        : "";

  return (
    <div className="grid gap-1">
      <GoalFields
        key={formKey}
        id={id}
        label={monthly ? `Each month of ${year}` : `Goal for ${year}`}
        year={year}
        span={span}
        goal={goal}
        pending={pending}
        formAction={formAction}
      />
      <p
        aria-live="polite"
        className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {message}
      </p>
    </div>
  );
}

function GoalFields({
  id,
  label,
  year,
  span,
  goal,
  pending,
  formAction,
}: {
  id: string;
  label: string;
  year: number;
  span: GoalSpan;
  goal: { target: number; unit: GoalUnit; countRereads: boolean } | null;
  pending: boolean;
  formAction: (formData: FormData) => void;
}) {
  // Re-reads mean nothing to a reading-days goal, so the box goes away.
  const [unit, setUnit] = useState<GoalUnit>(goal?.unit ?? "BOOKS");
  const monthly = span === "MONTH";
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="span" value={span} />
      <div className="grid gap-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </label>
        <Input
          id={id}
          name="target"
          type="number"
          min={0}
          max={unit === "DAYS" ? (monthly ? 31 : 366) : 1000000}
          defaultValue={goal?.target}
          placeholder={monthly ? "2" : "24"}
          className="w-28"
        />
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Counting</span>
        <Select name="unit" value={unit} onValueChange={(v) => setUnit(v as GoalUnit)}>
          <SelectTrigger className="w-36" aria-label="What the goal counts">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOOKS">Books</SelectItem>
            <SelectItem value="PAGES">Pages</SelectItem>
            <SelectItem value="DAYS">Days I read</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {unit !== "DAYS" && (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="countRereads"
            defaultChecked={goal?.countRereads ?? true}
            className="size-4 accent-primary"
          />
          Count re-reads
        </label>
      )}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving…" : goal ? "Update goal" : "Set goal"}
      </Button>
      {goal && (
        <span className="pb-2 text-xs text-muted-foreground">Set to 0 to remove the goal.</span>
      )}
    </form>
  );
}
