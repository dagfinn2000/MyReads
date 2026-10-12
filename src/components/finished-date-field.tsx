"use client";

import { useId, useState } from "react";
import { toDateInputValue } from "@/lib/display";
import { usePreferences } from "@/components/preferences-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A finish date with a "Don't remember" box beside it, for the add form
 * (a book added as Read) and the reading card. Ticking the box disables
 * the date, and a disabled input isn't submitted, so the server sees no
 * date and `finishedUnknown=on` and leaves the book undated instead of
 * stamping today. Unticking it with no date filled in puts today in, so
 * what the field shows is what gets saved.
 */
export function FinishedDateField({
  defaultDate,
  defaultUnknown,
}: {
  /** yyyy-mm-dd, or "" for none. */
  defaultDate: string;
  defaultUnknown: boolean;
}) {
  const { timeZone } = usePreferences();
  const id = useId();
  const [date, setDate] = useState(defaultDate);
  const [unknown, setUnknown] = useState(defaultUnknown);

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-date`}>Finished</Label>
        <Input
          id={`${id}-date`}
          name="dateFinished"
          type="date"
          className="w-40"
          value={unknown ? "" : date}
          disabled={unknown}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="finishedUnknown"
          checked={unknown}
          aria-describedby={unknown ? `${id}-hint` : undefined}
          onChange={(e) => {
            setUnknown(e.target.checked);
            if (!e.target.checked && !date) setDate(toDateInputValue(new Date(), timeZone));
          }}
          className="size-4 accent-primary"
        />
        Don&apos;t remember
      </label>
      {unknown && (
        <p id={`${id}-hint`} className="basis-full text-xs text-muted-foreground">
          Counts in Books read, but not in any year&apos;s stats or goal.
        </p>
      )}
    </div>
  );
}
