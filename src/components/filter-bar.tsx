"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookFormat } from "@prisma/client";
import { ArrowDownAZ, ArrowUpAZ, Layers, Search, X } from "lucide-react";
import { FORMAT_LABELS } from "@/lib/display";
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
}: {
  values: FilterValues;
  allTags: string[];
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
    if (next.minRating && next.minRating !== "all")
      params.set("minRating", next.minRating);
    if (next.series) params.set("series", next.series);
    if (next.group && next.group !== "none") params.set("group", next.group);
    if (next.sort && next.sort !== "createdAt") params.set("sort", next.sort);
    if (next.dir && next.dir !== "desc") params.set("dir", next.dir);
    const qs = params.toString();
    router.replace(`/books${qs ? `?${qs}` : ""}`);
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or author…"
          className="w-56 pl-8"
        />
      </div>

      <Select value={values.tag || "all"} onValueChange={(v) => navigate({ tag: v })}>
        <SelectTrigger className="w-36">
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

      <Select
        value={values.format || "all"}
        onValueChange={(v) => navigate({ format: v })}
      >
        <SelectTrigger className="w-32">
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
        value={values.minRating || "all"}
        onValueChange={(v) => navigate({ minRating: v })}
      >
        <SelectTrigger className="w-32">
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

      <div className="ml-auto flex items-center gap-1">
        <Select
          value={values.group || "none"}
          onValueChange={(v) => navigate({ group: v })}
        >
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-36">
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
          title={values.dir === "asc" ? "Ascending" : "Descending"}
          onClick={() => navigate({ dir: values.dir === "asc" ? "desc" : "asc" })}
        >
          {values.dir === "asc" ? <ArrowUpAZ /> : <ArrowDownAZ />}
        </Button>
      </div>
    </div>
  );
}
