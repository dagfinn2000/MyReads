"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { setTagState, tagList, type TagSelection } from "@/lib/library-filters";
import { cn, foldForSearch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Past this many tags the list gets a box to narrow it down. */
const FIND_FROM = 12;

type Match = "any" | "all";

const UNUSABLE_HINT = "Tags with a comma can't be filtered. Rename it in Manage tags.";

/**
 * The library's tag filter: a checklist of every tag, each one ticked to
 * include it or switched to "Not" to leave it out, and whether a book needs
 * any or all of the ticked ones. Every click applies straight away, like the
 * other filters, and the list stays open for the next one.
 *
 * The ticks live here as well as in the URL: two quick clicks would
 * otherwise build the second address from the first one's stale props and
 * lose the first tick.
 */
export function TagFilter({
  allTags,
  tagCounts,
  tag,
  notTag,
  tagMatch,
  onChange,
  className,
}: {
  allTags: string[];
  tagCounts: Record<string, number>;
  /** The URL's lists, comma-joined. */
  tag: string;
  notTag: string;
  tagMatch: string;
  onChange: (patch: { tag: string; notTag: string; tagMatch: string }) => void;
  className?: string;
}) {
  const fromProps = (): TagSelection & { match: Match } => ({
    include: tagList(tag),
    exclude: tagList(notTag),
    match: tagMatch === "all" ? "all" : "any",
  });
  // Follows the URL whenever it changes (a chip removed, a saved view
  // opened), without an effect: compared during render.
  const propsKey = `${tag}\n${notTag}\n${tagMatch}`;
  const [synced, setSynced] = useState(propsKey);
  const [sel, setSel] = useState(fromProps);
  if (synced !== propsKey) {
    setSynced(propsKey);
    setSel(fromProps());
  }
  const [find, setFind] = useState("");
  const matchLabel = useId();

  function apply(next: TagSelection & { match: Match }) {
    setSel(next);
    onChange({
      tag: next.include.join(","),
      notTag: next.exclude.join(","),
      tagMatch: next.include.length > 0 && next.match === "all" ? "all" : "",
    });
  }

  function setMatch(match: Match) {
    if (match === sel.match) return;
    // Without ticked tags there is nothing to match yet; keep the choice
    // for the first tick.
    if (sel.include.length === 0) setSel({ ...sel, match });
    else apply({ ...sel, match });
  }

  const count = sel.include.length + sel.exclude.length;
  const label =
    count === 0
      ? "Tags"
      : sel.include.length === 1 && sel.exclude.length === 0
        ? `Tag: ${sel.include[0]}`
        : `Tags (${count})`;

  const needle = foldForSearch(find.trim());
  const shown = needle ? allTags.filter((t) => foldForSearch(t).includes(needle)) : allTags;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-between border-input bg-transparent font-normal", className)}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Filter by tag"
        className="grid gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span id={matchLabel} className="text-sm font-medium">
            Match
          </span>
          <div
            role="radiogroup"
            aria-labelledby={matchLabel}
            className="inline-flex rounded-lg border p-0.5"
            onKeyDown={(e) => {
              const to: Match | null =
                e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? "any"
                  : e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? "all"
                    : null;
              if (!to) return;
              e.preventDefault();
              setMatch(to);
              e.currentTarget.querySelector<HTMLElement>(`[data-match="${to}"]`)?.focus();
            }}
          >
            {(["any", "all"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                data-match={m}
                aria-checked={sel.match === m}
                tabIndex={sel.match === m ? 0 : -1}
                onClick={() => setMatch(m)}
                className={cn(
                  "rounded-md px-2.5 py-0.5 text-sm",
                  sel.match === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "any" ? "Any" : "All"}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > FIND_FROM && (
          <Input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a tag"
            aria-label="Find a tag"
          />
        )}

        {allTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags match “{find.trim()}”.</p>
        ) : (
          <ul className="-mx-1 grid max-h-72 gap-0.5 overflow-y-auto">
            {shown.map((t) => {
              const state = sel.include.includes(t) ? "in" : sel.exclude.includes(t) ? "not" : "off";
              // Only from before tags were kept free of commas: the URL
              // lists tags comma-separated, so this one can't be in it.
              const unusable = t.includes(",");
              return (
                <li
                  key={t}
                  className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60"
                  title={unusable ? UNUSABLE_HINT : undefined}
                >
                  <label className="flex min-h-7 min-w-0 flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={state === "in"}
                      disabled={unusable}
                      onChange={(e) => apply({ ...sel, ...setTagState(sel, t, e.target.checked ? "in" : "off") })}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        state === "not" && "text-muted-foreground line-through",
                        unusable && "text-muted-foreground",
                      )}
                    >
                      {t}
                    </span>
                    {unusable && <span className="sr-only">{UNUSABLE_HINT}</span>}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {tagCounts[t]}
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-pressed={state === "not"}
                    aria-label={`Leave out books tagged ${t}`}
                    disabled={unusable}
                    onClick={() =>
                      apply({ ...sel, ...setTagState(sel, t, state === "not" ? "off" : "not") })
                    }
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-xs disabled:opacity-50",
                      state === "not"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Not
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
