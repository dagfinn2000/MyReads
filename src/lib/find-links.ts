import type { FindLink } from "@/lib/preferences";

type LinkBook = { isbn: string | null; title: string; authors: string[] };

/**
 * A "Find it at" pattern with this book's details filled in, or null when
 * the link can't be made: a placeholder it uses has nothing to fill it with
 * (no ISBN, no author), or the result somehow isn't an https:// address.
 * {author} is the first author. Each value is URL-encoded, so a title with
 * & or # can't break the query.
 */
export function fillFindLink(pattern: string, book: LinkBook): string | null {
  const values: Record<string, string> = {
    isbn: book.isbn?.trim() ?? "",
    title: book.title.trim(),
    author: book.authors[0]?.trim() ?? "",
  };
  let missing = false;
  // A function replacer, so a "$&" in a title is inserted as written.
  const href = pattern.replace(/\{(isbn|title|author)\}/g, (_, key: string) => {
    if (!values[key]) missing = true;
    return encodeURIComponent(values[key]);
  });
  if (missing) return null;
  try {
    return new URL(href).protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

/** The links to show on a book, in the reader's order. */
export function findLinksFor(
  links: FindLink[],
  book: LinkBook,
): { name: string; href: string }[] {
  return links.flatMap((link) => {
    const href = fillFindLink(link.url, book);
    return href ? [{ name: link.name, href }] : [];
  });
}
