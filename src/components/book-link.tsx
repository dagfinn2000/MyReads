"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canFlyCover, flyCover } from "@/lib/cover-flight";

/**
 * A link to a book's page whose cover flies across to the book page when
 * clicked (lib/cover-flight.ts). The cover is the first BookCover inside
 * the link. A ctrl- or middle-click still opens a new tab, and without view
 * transitions or with animations off it is an ordinary link.
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
      onNavigate={(e) => {
        const cover = ref.current?.querySelector<HTMLElement>(".book-cover");
        if (!cover || !canFlyCover()) return;
        e.preventDefault();
        flyCover(cover, bookId, () => router.push(href));
      }}
    >
      {children}
    </Link>
  );
}
