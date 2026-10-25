"use client";

import { ReadingStatus } from "@/lib/enums";
import { BookSpine, spineColourOf, type SpineBook } from "@/components/book-spine";
import { useCoverColours } from "@/lib/cover-colours";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** A book finished in the year, as the shelf needs it. */
export interface ShelfFinish {
  book: Pick<SpineBook, "id" | "title" | "authors" | "coverUrl" | "pageCount">;
  /** 0–11, in the reader's time zone. */
  month: number;
  /** The finish date, written the reader's way. */
  finished: string;
  reread: boolean;
}

/**
 * Every book finished in a year standing on a shelf, in the order they
 * were finished, with a little brass plate on the shelf where each month
 * starts (the Year in review page). The spines are the library's
 * (components/book-spine.tsx), without its bookmarks and outlines: here
 * every book is simply one you read.
 */
export function YearShelf({ year, finishes }: { year: number; finishes: ShelfFinish[] }) {
  const known = useCoverColours(finishes.flatMap((f) => (f.book.coverUrl ? [f.book.coverUrl] : [])));
  return (
    <ul className="spine-shelf year-shelf" data-size="medium" aria-label={`The books you finished in ${year}`}>
      {finishes.map((f, i) => {
        const startsMonth = i === 0 || finishes[i - 1].month !== f.month;
        const byline = f.book.authors.length ? `, by ${f.book.authors.join(", ")}` : "";
        return (
          <li
            key={`${f.book.id}-${i}`}
            className="spine-slot"
            data-month={startsMonth ? MONTHS[f.month] : undefined}
          >
            <BookSpine
              book={{ ...f.book, status: ReadingStatus.READ }}
              colour={spineColourOf(f.book, known)}
              label={`${f.book.title}${byline}. Finished ${f.finished}${f.reread ? ", a re-read" : ""}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
