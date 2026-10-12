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
} from "lucide-react";
import { saveLibraryView } from "@/lib/actions/library-view";
import { FORMAT_LABELS } from "@/lib/display";
import { activeFilterChips, searchPlaceholder } from "@/lib/library-filters";
import { naturalDir, type LibraryDisplay } from "@/lib/library-view";
import type { RatingStyle } from "@/lib/preferences";
import { canonicalViewQuery } from "@/lib/saved-views";
import { ActiveFilterChips } from "@/components/active-filter-chips";
import { LibraryViewMenu } from "@/components/library-view-menu";
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { MoreFilters, minRatingLabel } from "@/components/more-filters";
import { usePreferences } from "@/components/preferences-provider";
import { SaveViewDialog } from "@/components/save-view-dialog";
import { TagFilter } from "@/components/tag-filter";
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
  author: string;
  /** Comma-joined, like every list in the URL. */
  tag: string;
  tagMatch: string;
  notTag: string;
  format: string;
  /** Ownership filter: "all" | "owned" | "wishlist" | "borrowed" |
   *  "given_away" | "lent". Keeps the `owned` name so old links still work. */
  owned: string;
  minRating: string;
  finished: string;
  missing: string;
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
  { value: "dateStarted", label: "Date started" },
  { value: "pageCount", label: "Page count" },
  { value: "published", label: "Year published" },
  { value: "updatedAt", label: "Recently edited" },
];

/** `short` is what the closed menu shows on a phone, next to its icon. */
const GROUP_OPTIONS = [
  { value: "none", label: "No grouping", short: "No grouping" },
  { value: "author", label: "Group by author", short: "Author" },
  { value: "series", label: "Group by series", short: "Series" },
  { value: "yearFinished", label: "Group by year finished", short: "Year finished" },
  { value: "status", label: "Group by status", short: "Status" },
  { value: "format", label: "Group by format", short: "Format" },
  { value: "ownership", label: "Group by ownership", short: "Ownership" },
  { value: "tag", label: "Group by tag", short: "Tag" },
  { value: "shelf", label: "Group by shelf", short: "Shelf" },
  { value: "rating", label: "Group by rating", short: "Rating" },
];

/** Sorts by words: their direction reads A to Z, and the icon shows letters. */
const TEXT_SORTS = new Set(["title", "author"]);

const LETTERS = { asc: "Sorted A to Z. Click for Z to A.", desc: "Sorted Z to A. Click for A to Z." };
const DATES = {
  asc: "Sorted oldest first. Click for newest first.",
  desc: "Sorted newest first. Click for oldest first.",
};

/** Direction-toggle label per sort: names the current order and what a
 *  click does, in that sort's own words. */
const DIR_LABELS: Record<string, { asc: string; desc: string }> = {
  title: LETTERS,
  author: LETTERS,
  rating: {
    asc: "Sorted lowest rated first. Click for highest first.",
    desc: "Sorted highest rated first. Click for lowest first.",
  },
  createdAt: DATES,
  dateFinished: DATES,
  dateStarted: DATES,
  published: {
    asc: "Sorted oldest published first. Click for newest first.",
    desc: "Sorted newest published first. Click for oldest first.",
  },
  pageCount: {
    asc: "Sorted shortest first. Click for longest first.",
    desc: "Sorted longest first. Click for shortest first.",
  },
  updatedAt: {
    asc: "Sorted least recently edited first. Click for most recent first.",
    desc: "Sorted most recently edited first. Click for least recent first.",
  },
};

function dirTooltip(sort: string, asc: boolean): string {
  const labels = Object.hasOwn(DIR_LABELS, sort) ? DIR_LABELS[sort] : DATES;
  return asc ? labels.asc : labels.desc;
}

const OWNED_OPTIONS = [
  { value: "all", label: "Owned & wishlist" },
  { value: "owned", label: "Owned" },
  { value: "borrowed", label: "Borrowed" },
  { value: "given_away", label: "No longer have" },
  { value: "lent", label: "Lent out" },
  { value: "wishlist", label: "Wishlist" },
];

/** Each filter is at least half the row on phones, so they wrap two to a
 *  line instead of squeezing "All formats" down to "All fo". */
const HALF_ROW = "min-w-[calc(50%_-_0.25rem)] flex-1 sm:min-w-0 sm:flex-initial";

/**
 * Search/filter/sort controls. All state lives in the URL: every change
 * router.replace()s with updated query params and the server component
 * re-queries. Text search is debounced 300ms.
 */
export function FilterBar({
  values,
  allTags,
  tagCounts,
  display,
  ratingStyle,
  finishedYears,
}: {
  values: FilterValues;
  allTags: string[];
  /** Books per tag, for the tag list and the manage-tags dialog. */
  tagCounts: Record<string, number>;
  /** Card size, layout and card details, for the View menu. */
  display: LibraryDisplay;
  ratingStyle: RatingStyle;
  /** Years "Finished in" offers, newest first. */
  finishedYears: number[];
}) {
  const router = useRouter();
  const { searchAlsoIn } = usePreferences();
  const [search, setSearch] = useState(values.q);
  // The search the URL holds, or was last sent. The box follows the URL when
  // it changes from elsewhere (a saved view opened, Back), compared during
  // render like TagFilter; the echo of its own search leaves it alone, so
  // words typed during the round trip aren't undone.
  const [urlQ, setUrlQ] = useState(values.q);
  const [seenQ, setSeenQ] = useState(values.q);
  if (values.q !== seenQ) {
    setSeenQ(values.q);
    if (values.q !== urlQ) {
      setUrlQ(values.q);
      setSearch(values.q);
    }
  }
  const moreFiltersRef = useRef<HTMLButtonElement>(null);
  // Changes already sent but not back from the server yet. A second change
  // made before the page re-renders (two chips removed in quick succession)
  // builds on them rather than on the stale `values`, so it can't undo the
  // first. New props from the server are a new object, which clears them.
  const [sent, setSent] = useState({ base: values, changes: {} as Partial<FilterValues> });
  const pending = sent.base === values ? sent.changes : {};
  /** What the controls show: the server's values with those changes. */
  const current: FilterValues = { ...values, ...pending };

  function navigate(overrides: Partial<FilterValues>) {
    setSent({ base: values, changes: { ...pending, ...overrides } });
    const next = { ...current, q: search, ...overrides };
    setUrlQ(next.q.trim());
    // Same order as a saved view's address (saved-views.ts).
    const params = new URLSearchParams();
    if (next.shelf && next.shelf !== "all") params.set("shelf", next.shelf);
    if (next.shelfId) params.set("shelfId", next.shelfId);
    if (next.q) params.set("q", next.q);
    if (next.author) params.set("author", next.author);
    if (next.tag && next.tag !== "all") params.set("tag", next.tag);
    if (next.tag && next.tagMatch === "all") params.set("tagMatch", "all");
    if (next.notTag) params.set("notTag", next.notTag);
    if (next.format && next.format !== "all") params.set("format", next.format);
    if (next.owned && next.owned !== "all") params.set("owned", next.owned);
    if (next.minRating && next.minRating !== "all")
      params.set("minRating", next.minRating);
    if (next.finished) params.set("finished", next.finished);
    if (next.missing) params.set("missing", next.missing);
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

  // Debounced text search. Skips a box that already says what the URL does
  // (on mount, and after following the URL), which would only navigate to
  // the page already showing.
  useEffect(() => {
    if (search.trim() === urlQ) return;
    const t = setTimeout(() => navigate({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const chips = activeFilterChips(current, (v) => minRatingLabel(v, ratingStyle));
  const group = GROUP_OPTIONS.find((o) => o.value === current.group);
  const asc = current.dir === "asc";

  return (
    <div className="grid gap-2">
      {/* On phones the controls stack into tidy full-width rows (search with
          the view buttons, then filters, then grouping/sort); from sm up
          they keep their fixed widths and the view buttons go last. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Leaves exactly the room the two view buttons take: 2 × 2.25rem,
            plus the gaps. */}
        <div className="relative w-[calc(100%-5.25rem)] sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder(searchAlsoIn)}
            aria-label="Search the library"
            className="w-full pl-8 sm:w-56"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:order-last">
          <LibraryViewMenu display={display} ratings={ratingStyle !== "off"} />
          <SaveViewDialog query={canonicalViewQuery({ ...current, q: search })} />
        </div>

        <TagFilter
          allTags={allTags}
          tagCounts={tagCounts}
          tag={current.tag}
          notTag={current.notTag}
          tagMatch={current.tagMatch}
          onChange={navigate}
          className={`${HALF_ROW} sm:w-36`}
        />
        <ManageTagsDialog tagCounts={tagCounts} />

        <Select
          value={current.format || "all"}
          onValueChange={(v) => navigate({ format: v })}
        >
          <SelectTrigger className={`${HALF_ROW} sm:w-32`}>
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
          value={current.owned || "all"}
          onValueChange={(v) => navigate({ owned: v })}
        >
          <SelectTrigger className={`${HALF_ROW} sm:w-40`}>
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

        <MoreFilters
          values={current}
          finishedYears={finishedYears}
          ratingStyle={ratingStyle}
          onChange={navigate}
          triggerRef={moreFiltersRef}
          className={`${HALF_ROW} sm:w-40`}
        />

        <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
          <Select
            value={current.group || "none"}
            onValueChange={(v) => navigate({ group: v })}
          >
            <SelectTrigger className="min-w-0 flex-1 sm:w-56 sm:flex-initial" aria-label="Group by">
              <Layers className="size-4 text-muted-foreground" />
              <SelectValue>
                <span className="sm:hidden">{group?.short}</span>
                <span className="hidden sm:inline">{group?.label}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.filter(
                (o) => o.value !== "rating" || ratingStyle !== "off" || current.group === "rating",
              ).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={current.sort}
            // Each sort opens its natural way round: titles A to Z, the
            // rest newest, highest or longest first.
            onValueChange={(v) => navigate({ sort: v, dir: naturalDir(v) })}
          >
            <SelectTrigger className="min-w-0 flex-1 sm:w-40 sm:flex-initial" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.filter(
                (o) => o.value !== "rating" || ratingStyle !== "off" || current.sort === "rating",
              ).map((o) => (
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
            // The icon shows the current direction; the label names both the
            // state and the action (a bare state label reads as "click for
            // ascending" and makes the toggle feel reversed). Wording and
            // icon follow the active sort — "A to Z" only makes sense for
            // text sorts.
            title={dirTooltip(current.sort, asc)}
            aria-label={dirTooltip(current.sort, asc)}
            onClick={() => navigate({ dir: asc ? "desc" : "asc" })}
          >
            {TEXT_SORTS.has(current.sort) ? (
              asc ? <ArrowUpAZ /> : <ArrowDownAZ />
            ) : asc ? (
              <ArrowUpNarrowWide />
            ) : (
              <ArrowDownWideNarrow />
            )}
          </Button>
        </div>
      </div>

      <ActiveFilterChips
        chips={chips}
        onRemove={(chip) => navigate(chip.clear)}
        onClearAll={() =>
          navigate({
            author: "",
            tag: "",
            tagMatch: "",
            notTag: "",
            finished: "",
            minRating: "",
            missing: "",
            series: "",
          })
        }
        fallbackFocus={moreFiltersRef}
      />
    </div>
  );
}
