import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Saved views above the library: one chip per view, opening its filters,
 * sort and grouping. The view on screen (if any) is highlighted, with an ×
 * that clears its filters but keeps the sort. Views are saved from the
 * filter bar, and renamed, reordered or deleted on the Account page; the
 * page passes them in that order. Renders nothing until there is at least
 * one.
 */
export function SavedViewChips({
  views,
  currentQuery,
  clearHref,
}: {
  views: { id: string; name: string; query: string }[];
  /** The view on screen, in canonicalViewQuery form. */
  currentQuery: string;
  clearHref: string;
}) {
  if (views.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted-foreground">Views:</span>
      {views.map((view) => {
        const active = view.query === currentQuery;
        return (
          <span
            key={view.id}
            className={cn(
              "inline-flex items-center rounded-full border text-sm transition-colors hover:border-ring/60",
              active && "border-primary bg-primary/10 font-medium",
            )}
          >
            <Link
              href={`/books?${view.query}`}
              className={cn("flex items-center gap-1.5 py-1 pl-3", active ? "pr-1" : "pr-3")}
            >
              <Bookmark className="size-3.5" />
              {view.name}
            </Link>
            {active && (
              <Link
                href={clearHref}
                className="mr-1 rounded-full p-0.5 hover:bg-primary/20"
                title="Clear this view's filters"
              >
                <X className="size-3.5" />
                <span className="sr-only">Clear this view&apos;s filters</span>
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
