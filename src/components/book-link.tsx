"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canFlyCover, flyCover } from "@/lib/cover-flight";
import { noteBookOpened } from "@/lib/library-return";

/**
 * A link to a book's page whose cover flies across to the book page when
 * clicked (lib/cover-flight.ts). The cover is the first BookCover inside
 * the link, or the link itself when it carries `data-flight-cover` (a
 * spine in the reading room). A ctrl- or middle-click still opens a new
 * tab, and without view transitions or with animations off it is an
 * ordinary link.
 *
 * Followed from the library or the reading room, it also notes the way
 * back for the book page's X (lib/library-return.ts), and `data-book-link`
 * is how that X finds the card to fly the cover back into.
 *
 * Other attributes (a label, a tab index, data attributes) go on the link
 * as they are.
 */
export function BookLink({
  bookId,
  children,
  prefetch,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  bookId: string;
  /** Next.js prefetching; off for pages with hundreds of links in view. */
  prefetch?: boolean;
  [data: `data-${string}`]: string | number | undefined;
}) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const href = `/books/${bookId}`;

  return (
    <Link
      {...rest}
      ref={ref}
      href={href}
      prefetch={prefetch}
      data-book-link={bookId}
      onNavigate={(e) => {
        const link = ref.current;
        const cover =
          link?.querySelector<HTMLElement>(".book-cover") ??
          (link?.hasAttribute("data-flight-cover") ? link : null);
        noteBookOpened(bookId, cover);
        if (!cover || !canFlyCover()) return;
        e.preventDefault();
        flyCover(cover, bookId, () => router.push(href));
      }}
    >
      {children}
    </Link>
  );
}
