import Link from "next/link";
import { ReadingStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/display";
import { cn } from "@/lib/utils";

const SHELVES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  ...Object.values(ReadingStatus).map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
  })),
];

/**
 * Status shelves as links — the current shelf lives in the URL (?shelf=…) so
 * shelves compose with search/filter/sort params and survive refresh.
 */
export function ShelfTabs({
  current,
  counts,
  searchParams,
}: {
  current: string;
  counts: Record<string, number>;
  /** Current query params, so switching shelves keeps filters. */
  searchParams: Record<string, string>;
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {SHELVES.map(({ key, label }) => {
        const params = new URLSearchParams(searchParams);
        if (key === "all") params.delete("shelf");
        else params.set("shelf", key);
        const qs = params.toString();
        const active = current === key;
        return (
          <Link
            key={key}
            href={`/books${qs ? `?${qs}` : ""}`}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "border-primary font-medium text-foreground",
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
              {counts[key] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
