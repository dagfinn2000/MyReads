import { ExternalLink } from "lucide-react";
import { findLinksFor } from "@/lib/find-links";
import type { FindLink } from "@/lib/preferences";

/**
 * The reader's own "Find it at" links on a book's page (Preferences > Book
 * page), with the book's details filled in. Each opens in a new tab and
 * sends no referrer, so the library or shop doesn't learn this server's
 * address. Renders nothing when no link fits the book.
 */
export function FindItAt({
  book,
  links,
}: {
  book: { isbn: string | null; title: string; authors: string[] };
  links: FindLink[];
}) {
  const filled = findLinksFor(links, book);
  if (filled.length === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">Find it at</span>
      {filled.map((link, i) => (
        // The order is the identity: two links may share a name.
        <a
          key={i}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 rounded-sm wrap-anywhere underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {link.name}
          <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </p>
  );
}
