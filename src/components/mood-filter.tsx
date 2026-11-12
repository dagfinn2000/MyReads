"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { setTagState, type TagSelection } from "@/lib/library-filters";
import { moodList, type Mood } from "@/lib/moods";
import { cn } from "@/lib/utils";
import { MoodIcon } from "@/components/mood-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Match = "any" | "all";

/**
 * The library's mood filter, the tag filter's twin: every mood the reader
 * offers, each ticked to include it or switched to "Not" to leave it out,
 * and whether a book needs any or all of the ticked ones. Every click
 * applies at once and the list stays open for the next one.
 *
 * `moods` is the list to show, built by the bar: the offered moods, plus a
 * hidden one the address already names, so it can be unticked.
 */
export function MoodFilter({
  moods,
  moodCounts,
  mood,
  notMood,
  moodMatch,
  onChange,
  className,
}: {
  moods: Mood[];
  moodCounts: Record<string, number>;
  /** The URL's lists, comma-joined. */
  mood: string;
  notMood: string;
  moodMatch: string;
  onChange: (patch: { mood: string; notMood: string; moodMatch: string }) => void;
  className?: string;
}) {
  const fromProps = (): TagSelection & { match: Match } => ({
    include: moodList(mood),
    exclude: moodList(notMood),
    match: moodMatch === "all" ? "all" : "any",
  });
  // Follows the URL whenever it changes (a chip removed, a saved view
  // opened), compared during render like the tag filter.
  const propsKey = `${mood}\n${notMood}\n${moodMatch}`;
  const [synced, setSynced] = useState(propsKey);
  const [sel, setSel] = useState(fromProps);
  if (synced !== propsKey) {
    setSynced(propsKey);
    setSel(fromProps());
  }
  const matchLabel = useId();

  function apply(next: TagSelection & { match: Match }) {
    setSel(next);
    onChange({
      mood: next.include.join(","),
      notMood: next.exclude.join(","),
      moodMatch: next.include.length > 0 && next.match === "all" ? "all" : "",
    });
  }

  function setMatch(match: Match) {
    if (match === sel.match) return;
    if (sel.include.length === 0) setSel({ ...sel, match });
    else apply({ ...sel, match });
  }

  const count = sel.include.length + sel.exclude.length;
  const single =
    sel.include.length === 1 && sel.exclude.length === 0
      ? moods.find((m) => m.key === sel.include[0])
      : undefined;
  const anyBooks = moods.some((m) => (moodCounts[m.key] ?? 0) > 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-between border-input bg-transparent font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {single && <MoodIcon mood={single} className="size-4" />}
            <span className="min-w-0 truncate">
              {count === 0 ? "Moods" : single ? single.name : `Moods (${count})`}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Filter by mood"
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

        {!anyBooks && (
          <p className="text-xs text-muted-foreground">
            No book has a mood yet. Add them with “Add moods” on a book’s page.
          </p>
        )}

        <ul className="-mx-1 grid max-h-[min(28rem,55dvh)] gap-0.5 overflow-y-auto">
          {moods.map((m) => {
            const state = sel.include.includes(m.key)
              ? "in"
              : sel.exclude.includes(m.key)
                ? "not"
                : "off";
            const n = moodCounts[m.key] ?? 0;
            return (
              <li
                key={m.key}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60"
              >
                <label className="flex min-h-7 min-w-0 flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state === "in"}
                    onChange={(e) =>
                      apply({ ...sel, ...setTagState(sel, m.key, e.target.checked ? "in" : "off") })
                    }
                    className="size-4 shrink-0 accent-primary"
                  />
                  <MoodIcon mood={m} className="size-4" />
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      state === "not" && "text-muted-foreground line-through",
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {n > 0 ? n : ""}
                  </span>
                </label>
                <button
                  type="button"
                  aria-pressed={state === "not"}
                  aria-label={`Leave out books that feel ${m.name.toLowerCase()}`}
                  onClick={() =>
                    apply({ ...sel, ...setTagState(sel, m.key, state === "not" ? "off" : "not") })
                  }
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-xs",
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
      </PopoverContent>
    </Popover>
  );
}
