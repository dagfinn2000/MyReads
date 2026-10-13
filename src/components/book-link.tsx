"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canFlyCover, flyCover } from "@/lib/cover-flight";
import { noteBookOpened } from "@/lib/library-return";

/**
 * A link to a book's page whose cover flies across to the book page when
 * clicked (lib/cover-flight.ts). The cover is the first BookCover inside
 * the link. A ctrl- or middle-click still opens a new tab, and without view
 * transitions or with animations off it is an ordinary link.
 *
 * Followed from the library, it also notes the way back for the book page's
 * X (lib/library-return.ts), and `data-book-link` is how that X finds the
 * card to fly the cover back into.
 */
export function BookLink({
  bookId,
  className,
  title,
  children,
}: {
  bookId: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const href = `/books/${bookId}`;

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      title={title}
      data-book-link={bookId}
      onNavigate={(e) => {
        const cover = ref.current?.querySelector<HTMLElement>(".book-cover") ?? null;
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
