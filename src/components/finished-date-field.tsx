"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  // React keeps a controlled box's checked attribute at its mount-time
  // value, and the form reset React does after a save, a failed one
  // included, puts the box back to that while the date stays as the state
  // says: unticked, with the date still off, and neither sent. Keeping the
  // attribute in step makes the reset a no-op for it, as it is for the
  // date's value.
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.defaultChecked = unknown;
  }, [unknown]);

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
          ref={box}
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
