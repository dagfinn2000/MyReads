"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCopy, Check, Dices, Search } from "lucide-react";
import { savePreferences } from "@/lib/actions/preferences";
import type { QuoteOrder } from "@/lib/preferences";
import { newSeed, quotesHref, type QuotesParams } from "@/lib/quote-order";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ORDER_OPTIONS: { value: QuoteOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "book", label: "By book" },
  { value: "shuffle", label: "Shuffle" },
];

/**
 * Search, From, order and grouping for the quotes page. Same URL-state
 * pattern as the library's filter bar: every change router.replace()s with
 * new params and the server component re-queries. Order and grouping are
 * also saved on the account, so the plain nav link opens them next time.
 * Any change starts again from the first page of quotes.
 */
export function QuotesToolbar({
  params,
  shelves,
  tags,
  hasQuotes,
}: {
  params: Omit<QuotesParams, "limit">;
  /** Shelves and tags whose books have quotes. */
  shelves: { id: string; name: string }[];
  tags: string[];
  /** False when there are no quotes at all: only the search box shows. */
  hasQuotes: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(params.q);

  function navigate(over: Partial<QuotesParams>) {
    router.replace(quotesHref({ ...params, q: search, ...over }));
  }

  // Debounced text search. Nothing happens while the box matches the URL,
  // so mounting (or typing a letter and deleting it) doesn't navigate.
  useEffect(() => {
    if (search.trim() === params.q) return;
    const t = setTimeout(() => navigate({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function changeOrder(order: QuoteOrder) {
    navigate({ order, seed: order === "shuffle" ? newSeed() : null });
    savePreferences({ quotesOrder: order }).catch(() => {});
  }

  function toggleGroup() {
    navigate({ group: !params.group });
    savePreferences({ quotesGroupByBook: !params.group }).catch(() => {});
  }

  // From: one shelf or one tag. A pick that's no longer offered (its last
  // quote went, or the URL was typed) still gets an item, so the trigger
  // shows it and it can be cleared.
  const shelf = params.shelfId ? shelves.find((s) => s.id === params.shelfId) : undefined;
  const fromValue = params.shelfId
    ? `shelf:${params.shelfId}`
    : params.tag
      ? `tag:${params.tag}`
      : "all";
  const fromLabel = params.shelfId
    ? (shelf?.name ?? "shelf not found")
    : params.tag || "all books";
  const missingShelf = Boolean(params.shelfId) && !shelf;
  const missingTag = !params.shelfId && Boolean(params.tag) && !tags.includes(params.tag);
  const showFrom = shelves.length + tags.length > 0 || fromValue !== "all";

  function changeFrom(value: string) {
    const at = value.indexOf(":");
    const kind = at < 0 ? "all" : value.slice(0, at);
    const rest = value.slice(at + 1);
    navigate({
      shelfId: kind === "shelf" ? rest : "",
      tag: kind === "tag" ? rest : "",
    });
  }

  return (
    // On phones: search on its own row, then From, then order and
    // grouping. From sm up they sit in one row, order and grouping last.
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quotes, notes, books…"
          aria-label="Search quotes"
          className="w-full pl-8"
        />
      </div>

      {showFrom && (
        <Select value={fromValue} onValueChange={changeFrom}>
          <SelectTrigger aria-label="From" className="w-full sm:w-56">
            <SelectValue>
              <span className="truncate">From: {fromLabel}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">From: all books</SelectItem>
            {(shelves.length > 0 || missingShelf) && (
              <SelectGroup>
                <SelectLabel>Shelves</SelectLabel>
                {missingShelf && <SelectItem value={fromValue}>Shelf not found</SelectItem>}
                {shelves.map((s) => (
                  <SelectItem key={s.id} value={`shelf:${s.id}`}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {(tags.length > 0 || missingTag) && (
              <SelectGroup>
                <SelectLabel>Tags</SelectLabel>
                {missingTag && <SelectItem value={fromValue}>{params.tag}</SelectItem>}
                {tags.map((t) => (
                  <SelectItem key={t} value={`tag:${t}`}>
                    {t}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}

      {hasQuotes && (
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Select value={params.order} onValueChange={(v) => changeOrder(v as QuoteOrder)}>
            <SelectTrigger aria-label="Order" className="min-w-0 flex-1 sm:w-36 sm:flex-initial">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {params.order === "shuffle" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Shuffle again"
              title="Shuffle again"
              onClick={() => navigate({ seed: newSeed() })}
            >
              <Dices />
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            aria-pressed={params.group}
            onClick={toggleGroup}
            className={cn(
              params.group &&
                "border-primary bg-primary/10 hover:bg-primary/15 dark:border-primary dark:bg-primary/15 dark:hover:bg-primary/20",
            )}
          >
            {params.group ? <Check data-slot="icon" /> : <BookCopy data-slot="icon" />}
            Group by book
          </Button>
        </div>
      )}
    </div>
  );
}
