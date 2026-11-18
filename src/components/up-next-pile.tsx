"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadingStatus } from "@/lib/enums";
import { hash } from "@/lib/cover-art";
import { spineShape } from "@/lib/book-spine";
import { useCoverColours } from "@/lib/cover-colours";
import { motionAllowed } from "@/lib/motion";
import { BookSpine, spineColourOf, type SpineBook } from "@/components/book-spine";

/** What a book on the pile needs. */
export type PileBook = Pick<SpineBook, "id" | "title" | "authors" | "coverUrl" | "pageCount">;

/**
 * Up next on Now reading as books piled up on the table, lying flat with
 * their spines out (the library's spines, components/book-spine.tsx, laid
 * on their sides): the reader's own list on one pile, the next one to read
 * on top, and the suggestions on a pile beside it. No pile is quite
 * straight: each book lies a little off true and to one side, the same way
 * every visit (from its title).
 *
 * As the page opens (or, further down, once it scrolls into view) the
 * books drop onto the pile one after another from the bottom, each
 * wobbling as it lands. Put the list in another order (or
 * add to it) and the pile restacks: a book going up is pulled out to the
 * side and put back in its new place, the rest settle down around it. A
 * change made in "Edit list" waits for the dialog to close, so it happens
 * where it can be seen. All still with animations off.
 */
export function UpNextPile({ picks, suggested }: { picks: PileBook[]; suggested: PileBook[] }) {
  const known = useCoverColours([...picks, ...suggested].flatMap((b) => (b.coverUrl ? [b.coverUrl] : [])));
  return (
    <div className="up-next-piles">
      {picks.length > 0 && <Pile books={picks} known={known} numbered label="Your list" />}
      {suggested.length > 0 && (
        <Pile books={suggested} known={known} label={picks.length > 0 ? "Suggested" : "Suggested next"} />
      )}
    </div>
  );
}

/** True while a dialog (the list editor) is open. */
function dialogOpen(): boolean {
  return typeof document !== "undefined" && !!document.querySelector('[role="dialog"]');
}

/** A pile's books in the order shown, top first, as ids: the order given,
 *  except that a change while the list editor is open waits for it to
 *  close, so the pile restacks where it can be seen. */
function useShownOrder(ids: string[]): string[] {
  const key = ids.join("\n");
  const [shown, setShown] = useState(key);
  const [given, setGiven] = useState(key);
  if (key !== given) {
    setGiven(key);
    if (!dialogOpen()) setShown(key);
  }
  useEffect(() => {
    if (shown === key) return;
    const observer = new MutationObserver(() => {
      if (dialogOpen()) return;
      observer.disconnect();
      setShown(key);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [key, shown]);
  return shown ? shown.split("\n") : [];
}

function Pile({
  books,
  known,
  numbered,
  label,
}: {
  books: PileBook[];
  known: Record<string, string>;
  numbered?: boolean;
  label: string;
}) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const order = useShownOrder(books.map((b) => b.id)).filter((id) => byId.has(id));
  const orderKey = order.join("\n");
  const listRef = useRef<HTMLOListElement>(null);
  /** Where each book sat last time, from the top of the pile. */
  const tops = useRef<Map<string, number> | null>(null);
  const laidOut = useRef("");

  // A pile out of sight as the page opens (below the books being read, as
  // it mostly is) waits to drop its books on until it scrolls into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !motionAllowed() || list.getBoundingClientRect().top < window.innerHeight) return;
    list.dataset.waiting = "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        delete list.dataset.waiting;
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(list);
    return () => {
      observer.disconnect();
      delete list.dataset.waiting;
    };
  }, []);

  useLayoutEffect(() => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-pile-book]") ?? [])];
    const now = new Map(items.map((el) => [el.dataset.pileBook!, el.offsetTop]));
    const before = tops.current;
    tops.current = now;
    // The first time, CSS drops the books on (globals.css, "Up next pile").
    // (Development runs this twice over on the same order.)
    const changed = laidOut.current !== orderKey;
    laidOut.current = orderKey;
    if (!before || !changed) return;
    // And never again: a book React moves to another place in the list is
    // put back into the document, which would start its drop over.
    listRef.current!.dataset.settled = "";
    if (!motionAllowed()) return;
    items.forEach((el) => {
      const was = before.get(el.dataset.pileBook!);
      const at = now.get(el.dataset.pileBook!)!;
      if (was === undefined) drop(el);
      else if (Math.abs(was - at) > 1) restack(el, was - at);
    });
  }, [orderKey]);

  return (
    <div className="up-next-pile">
      <ol ref={listRef} className="pile" aria-label={numbered ? "Your Up next list" : "Suggested next"}>
        {order.map((id, i) => {
          const book = byId.get(id)!;
          const shape = spineShape(book);
          const h = hash(id);
          const byline = book.authors.length ? `, by ${book.authors.join(", ")}` : "";
          return (
            <li
              key={id}
              className="pile-book"
              data-pile-book={id}
              style={{ "--below": order.length - 1 - i } as React.CSSProperties}
            >
              <span
                className="pile-lie"
                style={
                  {
                    "--len": shape.height,
                    "--thick": `${shape.width}rem`,
                    // Never quite square on the one below.
                    "--dx": `${((h % 13) - 6) * 0.11}rem`,
                    "--tilt": `${(((h >>> 4) % 9) - 4) * 0.35}deg`,
                  } as React.CSSProperties
                }
              >
                <BookSpine
                  book={{ ...book, status: ReadingStatus.WANT_TO_READ }}
                  colour={spineColourOf(book, known)}
                  label={`${book.title}${byline}${numbered ? `. Number ${i + 1} on your list` : ""}`}
                />
              </span>
              {numbered && (
                <span className="pile-number" aria-hidden="true">
                  {i + 1}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** A book new to the pile drops onto its place and wobbles. */
function drop(el: HTMLElement) {
  el.animate(
    [
      { translate: "0 -2.5rem", opacity: 0, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)" },
      { translate: "0 0", opacity: 1, offset: 0.55 },
      { rotate: "1.6deg", offset: 0.7 },
      { rotate: "-0.9deg", offset: 0.84 },
      { rotate: "0.35deg", offset: 0.93 },
      { translate: "0 0", rotate: "0deg" },
    ],
    { duration: 700, easing: "ease-out" },
  );
}

/**
 * A book whose place on the pile changed, `by` pixels lower than it was
 * (or higher, when negative). One going up is pulled out to the side,
 * lifted and put back in, the way you take a book from a pile; one going
 * down sinks into place as the books under it go, and settles.
 */
function restack(el: HTMLElement, by: number) {
  if (by > 0) {
    const side = el.offsetWidth * 0.5;
    el.animate(
      [
        { translate: `0 ${by}px`, rotate: "0deg", zIndex: 2 },
        { translate: `${side}px ${by}px`, rotate: "-2deg", zIndex: 2, offset: 0.3 },
        { translate: `${side}px -0.75rem`, rotate: "1deg", zIndex: 2, offset: 0.62 },
        { translate: "0 0", rotate: "0deg", zIndex: 2, offset: 0.84 },
        { rotate: "1.2deg", zIndex: 2, offset: 0.91 },
        { translate: "0 0", rotate: "0deg", zIndex: 2 },
      ],
      { duration: 950, easing: "ease-in-out" },
    );
  } else {
    el.animate(
      [
        { translate: `0 ${by}px`, rotate: "0deg" },
        { translate: `0 ${by}px`, rotate: "0deg", offset: 0.35 },
        { translate: "0 0", rotate: "-0.8deg", offset: 0.75, easing: "ease-out" },
        { translate: "0 0", rotate: "0.4deg", offset: 0.88 },
        { translate: "0 0", rotate: "0deg" },
      ],
      { duration: 950, easing: "cubic-bezier(0.5, 0, 0.6, 1)" },
    );
  }
}
