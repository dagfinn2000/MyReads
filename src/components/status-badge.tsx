"use client";

import { usePreferences } from "@/components/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { SelectItem } from "@/components/ui/select";
import type { ReadingStatus } from "@/lib/enums";
import { STATUS_COLOR_DOT, bookStatusBadge, bookStatusName, statusOptions } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/** A book's status as a tinted badge, by the reader's own names
 *  (lib/statuses.ts). */
export function StatusBadge({
  status,
  statusKey,
  className,
}: {
  status: ReadingStatus;
  statusKey?: string | null;
  className?: string;
}) {
  const prefs = usePreferences();
  const book = { status, statusKey };
  return <Badge className={cn(bookStatusBadge(book, prefs), className)}>{bookStatusName(book, prefs)}</Badge>;
}

/** The items of a status menu: each built-in status, with the reader's own
 *  statuses on it set in under it. Values are statusChoice()s. */
export function StatusSelectItems() {
  const prefs = usePreferences();
  return statusOptions(prefs).map((o) => (
    <SelectItem key={o.value} value={o.value} className={o.color && "pl-5"}>
      {o.color && <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", STATUS_COLOR_DOT[o.color])} />}
      {o.label}
    </SelectItem>
  ));
}
