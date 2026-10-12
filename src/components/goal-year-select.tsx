"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The year in "Goal for [2026 ▾]". Each year is its own address (built on
 *  the server, so the period comes along); picking one goes there. */
export function GoalYearSelect({
  year,
  options,
}: {
  year: number;
  options: { year: number; href: string }[];
}) {
  const router = useRouter();
  return (
    <Select
      value={String(year)}
      onValueChange={(v) => {
        const option = options.find((o) => String(o.year) === v);
        if (option) router.push(option.href, { scroll: false });
      }}
    >
      <SelectTrigger size="sm" aria-label="Goal year" className="font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.year} value={String(o.year)}>
            {o.year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
