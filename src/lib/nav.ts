/** Which top-bar link a path belongs to (components/nav-link.tsx). A book's
 *  page and its edit page count as the library; adding and checking a book
 *  have links of their own. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/books") {
    return (
      pathname === "/books" ||
      (pathname.startsWith("/books/") &&
        !pathname.startsWith("/books/new") &&
        !pathname.startsWith("/books/check"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
