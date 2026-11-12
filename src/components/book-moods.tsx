"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, SmilePlus } from "lucide-react";
import { setBookMoods } from "@/lib/actions/moods";
import { MOOD_CHIP, bookMoods, moodHref, offeredMoods, type Mood } from "@/lib/moods";
import { cn } from "@/lib/utils";
import { MoodIcon } from "@/components/mood-icon";
import { usePreferences } from "@/components/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A mood as a tinted chip with its icon: on the book page each one links
 *  to the library's books with that mood. */
export function MoodChip({ mood, className }: { mood: Mood; className?: string }) {
  return (
    <Badge className={cn("mood-chip h-6 gap-1 px-2.5 text-xs", MOOD_CHIP[mood.color], className)}>
      <MoodIcon mood={mood} />
      {mood.name}
    </Badge>
  );
}

/**
 * A book's moods on its page, under its badges, and the picker that sets
 * them: every mood the reader offers, each a button that puts it on or
 * takes it off at once. A hidden built-in mood the book still has is
 * listed too, so it can be taken off. Changes are optimistic, like the
 * shelf checkboxes.
 */
export function BookMoods({ bookId, moods }: { bookId: string; moods: string[] }) {
  const prefs = usePreferences();
  const [current, setOptimistic] = useOptimistic(moods, (_: string[], next: string[]) => next);
  const [, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState("");

  const shown = bookMoods(current, prefs);
  const offered = offeredMoods(prefs);
  const choices = [
    ...offered,
    // Hidden ones it still has, at the end.
    ...shown.filter((m) => !offered.some((o) => o.key === m.key)),
  ];

  function toggle(mood: Mood) {
    const on = current.includes(mood.key);
    const next = on ? current.filter((k) => k !== mood.key) : [...current, mood.key];
    setAnnouncement(on ? `${mood.name} taken off.` : `${mood.name} added.`);
    startTransition(async () => {
      setOptimistic(next);
      await setBookMoods(bookId, next);
    });
  }

  return (
    <div className="book-moods -mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Moods">
      {shown.map((m) => (
        <Link
          key={m.key}
          href={moodHref(m.key)}
          title={`Books that feel ${m.name.toLowerCase()}`}
          className="rounded-4xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MoodChip mood={m} className="transition-[filter] hover:brightness-95 dark:hover:brightness-125" />
        </Link>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          {shown.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              title="Change moods"
              aria-label="Change moods"
            >
              <Pencil />
            </Button>
          ) : (
            <Button variant="ghost" size="xs" className="-ml-2 text-muted-foreground">
              <SmilePlus data-slot="icon" />
              Add moods
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={16} className="grid w-[22rem] gap-3">
          <p className="text-sm font-medium">How does it feel?</p>
          {choices.length === 0 && (
            <p className="text-sm text-muted-foreground">Every mood is turned off in Preferences.</p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {choices.map((m) => {
              const on = current.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m)}
                  className={cn(
                    "mood-choice flex min-h-8 min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on
                      ? cn("border-transparent font-medium", MOOD_CHIP[m.color])
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <MoodIcon mood={m} className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {on && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
          <Link
            href="/account#moods"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Hide moods, or add your own
          </Link>
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
