import Link from "next/link";
import type { ReadingStatus } from "@/lib/enums";
import { statusTabsToShow } from "@/lib/library-order";
import { STATUS_COLOR_DOT, statusName, type StatusPrefs } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/**
 * Status shelves as links — the current shelf lives in the URL (?shelf=…) so
 * shelves compose with search/filter/sort params and survive refresh.
 * "All" always shows; the others can be hidden in Preferences, though the
 * one on screen always keeps its tab. Each goes by the reader's name for
 * it, and a tab with statuses of the reader's own on it gets a row of them
 * underneath (?statusKey=…).
 */
export function ShelfTabs({
  current,
  currentKey = "",
  counts,
  keyCounts = {},
  searchParams,
  hidden = [],
  statuses = { statusNames: {}, customStatuses: [] },
}: {
  current: string;
  /** The reader's own status picked under the current tab, or "". */
  currentKey?: string;
  counts: Record<string, number>;
  /** Books on each of the reader's own statuses, by key. */
  keyCounts?: Record<string, number>;
  /** Current query params, so switching shelves keeps filters. */
  searchParams: Record<string, string>;
  /** Status tabs left out (Preferences > Library). */
  hidden?: ReadingStatus[];
  statuses?: StatusPrefs;
}) {
  const tabs = [
    { key: "all", label: "All" },
    ...statusTabsToShow(hidden, current).map((s) => ({ key: s, label: statusName(s, statuses) })),
  ];
  const href = (shelf: string, statusKey = "") => {
    const params = new URLSearchParams(searchParams);
    if (shelf === "all") params.delete("shelf");
    else params.set("shelf", shelf);
    if (statusKey) params.set("statusKey", statusKey);
    else params.delete("statusKey");
    const qs = params.toString();
    return `/books${qs ? `?${qs}` : ""}`;
  };
  const kinds = statuses.customStatuses.filter((c) => c.base === current);
  return (
    <div className="grid gap-2">
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map(({ key, label }) => {
          const active = current === key;
          return (
            <Link
              key={key}
              href={href(key)}
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
      {kinds.length > 0 && (
        <nav
          aria-label={`Kinds of ${statusName(current as ReadingStatus, statuses)}`}
          className="flex flex-wrap gap-1.5"
        >
          <Link
            href={href(current)}
            aria-current={!currentKey ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
              !currentKey && "border-primary bg-primary/10 font-medium",
            )}
          >
            All
          </Link>
          {kinds.map((c) => (
            <Link
              key={c.key}
              href={href(current, c.key)}
              aria-current={currentKey === c.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:border-ring/60",
                currentKey === c.key && "border-primary bg-primary/10 font-medium",
              )}
            >
              <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_COLOR_DOT[c.color])} />
              {c.name}
              <span className="text-xs text-muted-foreground tabular-nums">{keyCounts[c.key] ?? 0}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
