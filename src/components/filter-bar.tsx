"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookFormat } from "@prisma/client";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  Layers,
  Search,
  X,
} from "lucide-react";
import { saveLibraryView } from "@/lib/actions/library-view";
import { FORMAT_LABELS } from "@/lib/display";
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterValues {
  shelf: string;
  shelfId: string;
  q: string;
  tag: string;
  format: string;
  /** "all" | "owned" | "wishlist" (owned flag unset). */
  owned: string;
  minRating: string;
  series: string;
  group: string;
  sort: string;
  dir: string;
}

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date added" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "rating", label: "Rating" },
  { value: "dateFinished", label: "Date finished" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "author", label: "Group by author" },
  { value: "series", label: "Group by series" },
];

/** Direction-toggle tooltip: names the current order and what a click does,
 *  phrased for the active sort — letters for the text sorts, low/high for
 *  rating, old/new for the date sorts. */
function dirTooltip(sort: string, asc: boolean): string {
  if (sort === "title" || sort === "author") {
    return asc ? "Sorted A–Z — click for Z–A" : "Sorted Z–A — click for A–Z";
  }
  if (sort === "rating") {
    return asc
      ? "Sorted lowest rated first — click for highest first"
      : "Sorted highest rated first — click for lowest first";
  }
  // createdAt / dateFinished
  return asc
    ? "Sorted oldest first — click for newest first"
    : "Sorted newest first — click for oldest first";
}

const OWNED_OPTIONS = [
  { value: "all", label: "Owned & wishlist" },
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
];

const RATING_OPTIONS = [
  { value: "all", label: "Any rating" },
  { value: "4", label: "≥ 2 stars" },
  { value: "6", label: "≥ 3 stars" },
  { value: "8", label: "≥ 4 stars" },
  { value: "9", label: "≥ 4.5 stars" },
  { value: "10", label: "5 stars" },
];

/**
 * Search/filter/sort controls. All state lives in the URL: every change
 * router.replace()s with updated query params and the server component
 * re-queries. Text search is debounced 300ms.
 */
export function FilterBar({
  values,
  allTags,
  tagCounts,
}: {
  values: FilterValues;
  allTags: string[];
  /** Books per tag, for the manage-tags dialog. */
  tagCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(values.q);
  const first = useRef(true);

  function navigate(overrides: Partial<FilterValues>) {
    const next = { ...values, q: search, ...overrides };
    const params = new URLSearchParams();
    if (next.shelf && next.shelf !== "all") params.set("shelf", next.shelf);
    if (next.shelfId) params.set("shelfId", next.shelfId);
    if (next.q) params.set("q", next.q);
    if (next.tag && next.tag !== "all") params.set("tag", next.tag);
    if (next.format && next.format !== "all") params.set("format", next.format);
    if (next.owned && next.owned !== "all") params.set("owned", next.owned);
    if (next.minRating && next.minRating !== "all")
      params.set("minRating", next.minRating);
    if (next.series) params.set("series", next.series);
    // View params are always explicit in the URL, so the page never has to
    // guess between "reset to default" and "no preference stated" — the
    // account-saved view only fills in on param-less visits (the nav link).
    params.set("group", next.group || "none");
    params.set("sort", next.sort || "createdAt");
    params.set("dir", next.dir || "desc");
    const qs = params.toString();
    router.replace(`/books${qs ? `?${qs}` : ""}`);

    // A change to the view is a lasting preference — remember it on the
    // account (fire-and-forget; the URL is already correct either way).
    if ("sort" in overrides || "dir" in overrides || "group" in overrides) {
      saveLibraryView({
        sort: next.sort || "createdAt",
        dir: next.dir || "desc",
        group: next.group || "none",
      }).catch(() => {});
    }
  }

  // Debounced text search. Skips the initial render so mounting doesn't
  // cause a redundant navigation.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => navigate({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    // On phones the controls stack into tidy full-width rows (search, then
    // filters, then grouping/sort); from sm up they keep their fixed widths.
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or author…"
          className="w-full pl-8 sm:w-56"
        />
      </div>

      <Select value={values.tag || "all"} onValueChange={(v) => navigate({ tag: v })}>
        <SelectTrigger className="min-w-0 flex-1 sm:w-36 sm:flex-initial">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {allTags.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ManageTagsDialog tagCounts={tagCounts} />

      <Select
        value={values.format || "all"}
        onValueChange={(v) => navigate({ format: v })}
      >
        <SelectTrigger className="min-w-0 flex-1 sm:w-32 sm:flex-initial">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All formats</SelectItem>
          {Object.values(BookFormat).map((f) => (
            <SelectItem key={f} value={f}>
              {FORMAT_LABELS[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.owned || "all"}
        onValueChange={(v) => navigate({ owned: v })}
      >
        <SelectTrigger className="min-w-0 flex-1 sm:w-40 sm:flex-initial">
          <SelectValue placeholder="Owned" />
        </SelectTrigger>
        <SelectContent>
          {OWNED_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.minRating || "all"}
        onValueChange={(v) => navigate({ minRating: v })}
      >
        <SelectTrigger className="min-w-0 flex-1 sm:w-32 sm:flex-initial">
          <SelectValue placeholder="Rating" />
        </SelectTrigger>
        <SelectContent>
          {RATING_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {values.series && (
        <button
          type="button"
          onClick={() => navigate({ series: "" })}
          className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm"
          title="Clear series filter"
        >
          Series: {values.series}
          <X className="size-3.5" />
        </button>
      )}

      <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
        <Select
          value={values.group || "none"}
          onValueChange={(v) => navigate({ group: v })}
        >
          <SelectTrigger className="min-w-0 flex-1 sm:w-44 sm:flex-initial">
            <Layers className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={values.sort} onValueChange={(v) => navigate({ sort: v })}>
          <SelectTrigger className="min-w-0 flex-1 sm:w-36 sm:flex-initial">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          // The icon shows the current direction; the tooltip names both the
          // state and the action (a bare state label reads as "click for
          // ascending" and makes the toggle feel reversed). Wording and icon
          // follow the active sort — "A–Z" only makes sense for text sorts.
          title={dirTooltip(values.sort, values.dir === "asc")}
          onClick={() => navigate({ dir: values.dir === "asc" ? "desc" : "asc" })}
        >
          {values.sort === "title" || values.sort === "author" ? (
            values.dir === "asc" ? <ArrowUpAZ /> : <ArrowDownAZ />
          ) : values.dir === "asc" ? (
            <ArrowUpNarrowWide />
          ) : (
            <ArrowDownWideNarrow />
          )}
        </Button>
      </div>
    </div>
  );
}
