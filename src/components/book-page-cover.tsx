"use client";

import { useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Sticker as StickerIcon } from "lucide-react";
import type { Book } from "@prisma/client";
import { BookCover, type CoverWear, type ReadingAt } from "@/components/book-card";
import { StickerArt } from "@/components/cover-stickers";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setBookStickers } from "@/lib/actions/stickers";
import { motionAllowed } from "@/lib/motion";
import type { StoppedAt } from "@/lib/shelf-wear";
import { STICKERS, type Sticker } from "@/lib/stickers";
import { cn } from "@/lib/utils";

/**
 * A book page's own cover, with the buttons under it (`children`: Edit and
 * Delete) and the sticker picker beside them. Pinning or peeling a sticker
 * shows on the cover at once (optimistic, like the mood picker), and one
 * pinned just now presses on with a little bounce.
 */
export function BookPageCover({
  bookId,
  book,
  reading,
  stopped,
  wear,
  stickers,
  children,
}: {
  bookId: string;
  book: Pick<Book, "title" | "coverUrl" | "authors">;
  reading: ReadingAt | null;
  stopped?: StoppedAt | null;
  wear?: CoverWear;
  stickers: string[];
  children: React.ReactNode;
}) {
  const [current, setOptimistic] = useOptimistic(stickers, (_: string[], next: string[]) => next);
  const [fresh, setFresh] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState("");
  // The page puts the cover in a column of its own from md up.
  const beside = useSyncExternalStore(subscribeWide, isWide, () => true);
  const coverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // How far the picker sits from its button to clear the cover.
  const [past, setPast] = useState(16);
  const pickerRef = useRef<HTMLDivElement>(null);
  function measure(open: boolean) {
    const cover = coverRef.current?.getBoundingClientRect();
    const button = triggerRef.current?.getBoundingClientRect();
    if (open && cover && button) setPast(Math.max(4, Math.round(cover.right - button.right + 16)));
    if (open && !beside) requestAnimationFrame(() => requestAnimationFrame(showPicker));
  }
  // On a phone the picker hangs under the buttons; scroll it fully into
  // sight if the screen is too short, but never the buttons off the top.
  function showPicker() {
    const button = triggerRef.current?.getBoundingClientRect();
    const picker = pickerRef.current;
    if (!button || !picker) return;
    const short = button.bottom + 4 + picker.offsetHeight + 16 - window.innerHeight;
    const by = Math.min(short, button.top - 72);
    if (by > 0) window.scrollBy({ top: by, behavior: motionAllowed() ? "smooth" : "auto" });
  }

  function save(next: string[], said: string) {
    setAnnouncement(said);
    startTransition(async () => {
      setOptimistic(next);
      await setBookStickers(bookId, next);
    });
  }

  function toggle(sticker: Sticker) {
    const on = current.includes(sticker.key);
    if (on) {
      save(
        current.filter((k) => k !== sticker.key),
        `${sticker.name} taken off.`,
      );
    } else {
      setFresh((f) => [...f, sticker.key]);
      save([...current, sticker.key], `${sticker.name} pinned on the cover.`);
    }
  }

  const cover = (
    <BookCover
        book={book}
        className="hero-cover aspect-[2/3] w-full max-w-60"
        loading="eager"
        flightTarget={bookId}
        tilt
        reading={reading}
        stopped={stopped}
        wear={wear}
        stickers={current}
        freshStickers={fresh}
      />
  );

  return (
    <Popover onOpenChange={measure}>
      <div className="grid content-start gap-3">
        <div ref={coverRef}>{cover}</div>
        <div className="flex flex-wrap gap-2">
          {children}
          <PopoverTrigger asChild>
            <Button ref={triggerRef} variant="outline" size="sm" title="Pin stickers on the cover">
              <StickerIcon data-slot="icon" />
              Stickers
            </Button>
          </PopoverTrigger>
          {/* Beside the cover where there's room (pushed out past its
              right edge), so it stays in sight while stickers go on. On a
              phone it stays under the buttons, never flipping up over the
              cover (no edge to collide with below), and the page scrolls
              to the rest of it. */}
          <PopoverContent
            ref={pickerRef}
            side={beside ? "right" : "bottom"}
            align={beside ? "end" : "start"}
            sideOffset={beside ? past : 4}
            collisionPadding={beside ? 16 : { top: 16, right: 16, left: 16, bottom: -100_000 }}
            className="grid w-[22rem] max-w-[calc(100vw-2rem)] gap-3"
          >
            <div>
              <p className="text-sm font-medium">Pin a sticker on the cover</p>
              <p className="text-xs text-muted-foreground">
                In the order you pin them. The library shows the first two on small covers,
                up to four on big ones.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {STICKERS.map((s) => {
                const place = current.indexOf(s.key);
                const on = place >= 0;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s)}
                    className={cn(
                      "flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2 py-1 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on
                        ? "border-primary/50 bg-primary/8 font-medium"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <StickerArt sticker={s.key} className="sticker-choice h-8 w-auto shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {on && (
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums"
                        title={`Pinned ${ordinal(place + 1)}`}
                      >
                        {place + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {current.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="justify-self-start text-muted-foreground"
                onClick={() => save([], "Every sticker taken off.")}
              >
                Peel them all off
              </Button>
            )}
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
          </PopoverContent>
        </div>
      </div>
    </Popover>
  );
}

const WIDE = "(min-width: 48rem)";
function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isWide(): boolean {
  return window.matchMedia(WIDE).matches;
}

function ordinal(n: number): string {
  return ["first", "second", "third", "fourth"][n - 1] ?? `${n}th`;
}
