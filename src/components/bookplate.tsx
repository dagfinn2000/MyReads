import { cn } from "@/lib/utils";

/**
 * An "Ex libris" plate, as pasted inside the front cover of a book that's
 * yours: a small printed label with a frame of two fine rules and a
 * flourish in each corner, an open book, your name in italics and the
 * book's number in your library with the year it came in. Printed in the
 * theme's own ink on a paper tinted by it (globals.css, "Bookplates"), in
 * Literata whatever face the page is set in, as a plate is printed once.
 *
 * Shown on the pages of printed books you own (lib/bookplate.ts), unless
 * Preferences › Appearance › Bookplate is off.
 */
export function Bookplate({
  name,
  number,
  year,
  className,
}: {
  name: string;
  number: number;
  year: number;
  className?: string;
}) {
  return (
    <aside className={cn("bookplate", className)} aria-label="Bookplate">
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <Flourish key={corner} corner={corner} />
      ))}
      <p className="bookplate-ex">Ex libris</p>
      <OpenBook />
      <p className="bookplate-name">{name}</p>
      <span className="bookplate-rule" aria-hidden="true" />
      <p className="bookplate-number">
        <abbr title="Number">No.</abbr> {number} · {year}
      </p>
    </aside>
  );
}

/** A corner of the frame: a quarter curl ending in a dot. */
function Flourish({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg className="bookplate-corner" data-corner={corner} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M1.5 16.5V8.5C1.5 4.6 4.6 1.5 8.5 1.5H16.5" />
      <path d="M4.5 16.5V10C4.5 7 7 4.5 10 4.5H16.5" opacity="0.55" />
      <circle cx="9.25" cy="9.25" r="1.1" />
    </svg>
  );
}

/** The plate's picture: an open book, its pages lined. */
function OpenBook() {
  return (
    <svg className="bookplate-book" viewBox="0 0 44 26" aria-hidden="true">
      <path d="M22 5.5C16.6 2.8 10 2.4 3.5 4V21.4C10 19.9 16.6 20.4 22 23.2C27.4 20.4 34 19.9 40.5 21.4V4C34 2.4 27.4 2.8 22 5.5Z" />
      <path d="M22 5.5V23.2" />
      <path
        opacity="0.6"
        d="M7 8.2C10.6 7.4 14.4 7.6 18.2 9M7 11.4C10.6 10.6 14.4 10.8 18.2 12.2M7 14.6C10.6 13.8 14.4 14 18.2 15.4M25.8 9C29.6 7.6 33.4 7.4 37 8.2M25.8 12.2C29.6 10.8 33.4 10.6 37 11.4M25.8 15.4C29.6 14 33.4 13.8 37 14.6"
      />
      <path d="M1.5 23.8C8.6 22.2 15.6 22.6 22 25.2C28.4 22.6 35.4 22.2 42.5 23.8" opacity="0.55" />
    </svg>
  );
}
