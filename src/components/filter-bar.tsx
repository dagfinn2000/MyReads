"use client";

import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookFormat } from "@/lib/enums";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  Layers,
  Search,
} from "lucide-react";
import { rememberLibraryView } from "@/lib/actions/library-view";
import { FORMAT_LABELS } from "@/lib/display";
import { activeFilterChips, searchPlaceholder } from "@/lib/library-filters";
import { naturalDir, type LibraryDisplay } from "@/lib/library-view";
import type { RatingStyle } from "@/lib/preferences";
import { canonicalViewQuery } from "@/lib/saved-views";
import { fieldFilterLabel } from "@/lib/book-fields";
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
  statusKey: string;
  shelfId: string;
  q: string;
  author: string;
  /** Comma-joined, like every list in the URL. */
  tag: string;
  tagMatch: string;
  notTag: string;
  format: string;
  /** Ownership filter: "all" | "owned" | "wishlist" | "borrowed" |
   *  "given_away" | "lent" | "overdue". Keeps the `owned` name so old links
   *  still work. */
  owned: string;
  minRating: string;
  finished: string;
  missing: string;
  series: string;
  /** One of the reader's own fields (lib/book-fields.ts parseFieldFilter). */
  field: string;
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
  { value: "overdue", label: "Overdue" },
  { value: "wishlist", label: "Wishlist" },
];

/** Each filter is at least half the row on phones, so they wrap two to a
 *  line instead of squeezing "All formats" down to "All fo". */
const HALF_ROW = "min-w-[calc(50%_-_0.25rem)] flex-1 sm:min-w-0 sm:flex-initial";

const FORMAT_OPTIONS = [
  { value: "all", label: "All formats" },
  ...Object.values(BookFormat).map((f) => ({ value: f, label: FORMAT_LABELS[f] })),
];
const NO_CHANGES: Partial<FilterValues> = {};

/**
 * One of the bar's lists. A closed Radix Select still draws every item,
 * off the page, so its button can show the chosen one; drawn again only
 * when its own value or items change, the four of them no longer redraw
 * thirty-odd items for each letter typed in the search box.
 */
const BarSelect = memo(function BarSelect({
  value,
  options,
  onValueChange,
  className,
  label,
  placeholder,
  children,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
  className: string;
  label?: string;
  placeholder?: string;
  /** What the closed list shows, when it isn't the chosen item's label: a
   *  SelectValue given its text, since the list isn't drawn to give it. */
  children?: React.ReactNode;
}) {
  return (
    // Its list drawn only when wanted, too (ui/select.tsx): coming back to
    // the library drew all four, hidden, before the page could answer.
    <Select lazyList value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className} aria-label={label}>
        {children ?? (
          <SelectValue placeholder={placeholder}>
            {options.find((o) => o.value === value)?.label}
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

// The rest of the bar, likewise drawn again only when what it's given
// changes: typing a search redraws the box and the Save view button, which
// saves what it says, and nothing else.
const MemoTagFilter = memo(TagFilter);
const MemoManageTags = memo(ManageTagsDialog);
const MemoMoreFilters = memo(MoreFilters);
const MemoViewMenu = memo(LibraryViewMenu);
const MemoChips = memo(ActiveFilterChips);

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
  const prefs = usePreferences();
  const { searchAlsoIn } = prefs;
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
  const pending = sent.base === values ? sent.changes : NO_CHANGES;
  /** What the controls show: the server's values with those changes. */
  const current: FilterValues = useMemo(() => ({ ...values, ...pending }), [values, pending]);

  function navigate(overrides: Partial<FilterValues>) {
    setSent({ base: values, changes: { ...pending, ...overrides } });
    const next = { ...current, q: search, ...overrides };
    setUrlQ(next.q.trim());
    // Same order as a saved view's address (saved-views.ts).
    const params = new URLSearchParams();
    if (next.shelf && next.shelf !== "all") params.set("shelf", next.shelf);
    if (next.shelf && next.shelf !== "all" && next.statusKey) params.set("statusKey", next.statusKey);
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
    if (next.field) params.set("field", next.field);
    // View params are always explicit in the URL, so the page never has to
    // guess between "reset to default" and "no preference stated" — the
    // account-saved view only fills in on param-less visits (the nav link).
    params.set("group", next.group || "none");
    params.set("sort", next.sort || "createdAt");
    params.set("dir", next.dir || "desc");
    const qs = params.toString();
    router.replace(`/books${qs ? `?${qs}` : ""}`);

    // A change to the view is a lasting preference — remember it on the
    // account (fire-and-forget; the URL is already correct either way, so
    // nothing is drawn again for it).
    if ("sort" in overrides || "dir" in overrides || "group" in overrides) {
      rememberLibraryView({
        sort: next.sort || "createdAt",
        dir: next.dir || "desc",
        group: next.group || "none",
      }).catch(() => {});
    }
  }

  // The latest navigate, for the parts of the bar: they're handed the same
  // function every time, so they can skip redrawing.
  const navigateRef = useRef(navigate);
  useLayoutEffect(() => {
    navigateRef.current = navigate;
  });
  const go = useCallback((overrides: Partial<FilterValues>) => navigateRef.current(overrides), []);
  const onFormat = useCallback((v: string) => go({ format: v }), [go]);
  const onOwned = useCallback((v: string) => go({ owned: v }), [go]);
  const onGroup = useCallback((v: string) => go({ group: v }), [go]);
  // Each sort opens its natural way round: titles A to Z, the rest newest,
  // highest or longest first.
  const onSort = useCallback((v: string) => go({ sort: v, dir: naturalDir(v) }), [go]);
  const onRemoveChip = useCallback((chip: { clear: Partial<FilterValues> }) => go(chip.clear), [go]);
  const onClearAll = useCallback(
    () =>
      go({
        author: "",
        tag: "",
        tagMatch: "",
        notTag: "",
        finished: "",
        minRating: "",
        missing: "",
        series: "",
        field: "",
      }),
    [go],
  );

  // Debounced text search. Skips a box that already says what the URL does
  // (on mount, and after following the URL), which would only navigate to
  // the page already showing.
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (search.trim() === urlQ) return;
    searchTimer.current = setTimeout(() => navigate({ q: search }), 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // A shelf tab or chip (inside `data-keeps-search`) followed while the box
  // holds words its link lacks. Those links were drawn by the server before
  // the words were typed, or before the search they started came back, so
  // the link dropped the search; or the search, sent a moment later from
  // the page as it was, undid the click. The link takes the words along.
  const carrySearch = useEffectEvent((e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const link =
      e.target instanceof Element
        ? e.target.closest<HTMLAnchorElement>("[data-keeps-search] a[href]")
        : null;
    if (!link) return;
    const q = search.trim();
    const url = new URL(link.href);
    if ((url.searchParams.get("q") ?? "") === q) return;
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    // Before the link's own click handler, which then leaves it be.
    e.preventDefault();
    clearTimeout(searchTimer.current);
    setUrlQ(q);
    router.push(`${url.pathname}${url.search}`);
  });
  useEffect(() => {
    const onClick = (e: MouseEvent) => carrySearch(e);
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const chips = useMemo(
    () =>
      activeFilterChips(
        current,
        (v) => minRatingLabel(v, ratingStyle),
        (field) => fieldFilterLabel(field, prefs.customFields, prefs),
      ),
    [current, ratingStyle, prefs],
  );
  const group = GROUP_OPTIONS.find((o) => o.value === current.group);
  // Made once per grouping, so the list can skip redrawing.
  const groupValue = useMemo(
    () => (
      <>
        <Layers className="size-4 text-muted-foreground" />
        <SelectValue>
          <span className="sm:hidden">{group?.short}</span>
          <span className="hidden sm:inline">{group?.label}</span>
        </SelectValue>
      </>
    ),
    [group],
  );
  const ratings = ratingStyle !== "off";
  const groupOptions = useMemo(
    () => GROUP_OPTIONS.filter((o) => o.value !== "rating" || ratings || current.group === "rating"),
    [ratings, current.group],
  );
  const sortOptions = useMemo(
    () => SORT_OPTIONS.filter((o) => o.value !== "rating" || ratings || current.sort === "rating"),
    [ratings, current.sort],
  );
  const asc = current.dir === "asc";

  return (
    <div className="grid grid-cols-1 gap-2">
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
            // The / shortcut's target (components/keyboard-shortcuts.tsx).
            data-library-search=""
            className="w-full pl-8 sm:w-56"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:order-last">
          <MemoViewMenu display={display} ratings={ratings} />
          <SaveViewDialog query={canonicalViewQuery({ ...current, q: search })} />
        </div>

        <MemoTagFilter
          allTags={allTags}
          tagCounts={tagCounts}
          tag={current.tag}
          notTag={current.notTag}
          tagMatch={current.tagMatch}
          onChange={go}
          className={`${HALF_ROW} sm:w-36`}
        />
        <MemoManageTags tagCounts={tagCounts} />

        <BarSelect
          value={current.format || "all"}
          options={FORMAT_OPTIONS}
          onValueChange={onFormat}
          className={`${HALF_ROW} sm:w-32`}
          placeholder="Format"
        />

        <BarSelect
          value={current.owned || "all"}
          options={OWNED_OPTIONS}
          onValueChange={onOwned}
          className={`${HALF_ROW} sm:w-40`}
          placeholder="Owned"
        />

        <MemoMoreFilters
          values={current}
          finishedYears={finishedYears}
          ratingStyle={ratingStyle}
          fields={prefs.customFields}
          onChange={go}
          triggerRef={moreFiltersRef}
          className={`${HALF_ROW} sm:w-40`}
        />

        <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
          <BarSelect
            value={current.group || "none"}
            options={groupOptions}
            onValueChange={onGroup}
            className="min-w-0 flex-1 sm:w-56 sm:flex-initial"
            label="Group by"
          >
            {groupValue}
          </BarSelect>
          <BarSelect
            value={current.sort}
            options={sortOptions}
            onValueChange={onSort}
            className="min-w-0 flex-1 sm:w-40 sm:flex-initial"
            label="Sort by"
          />
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

      <MemoChips
        chips={chips}
        onRemove={onRemoveChip}
        onClearAll={onClearAll}
        fallbackFocus={moreFiltersRef}
      />
    </div>
  );
}
