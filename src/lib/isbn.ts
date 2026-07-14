/**
 * ISBN helpers for matching a scanned/typed ISBN against the library.
 *
 * Books get stored with whichever form the metadata source returned (often
 * ISBN-10 from older Open Library records), while barcodes always scan as
 * ISBN-13 — so an ownership check has to try both forms of the same number.
 */

/** Strip spaces and hyphens; uppercase a trailing x check digit. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Check digit for a 13-digit ISBN, given its first 12 digits. */
function isbn13CheckDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/** Check digit for a 10-digit ISBN, given its first 9 digits. */
function isbn10CheckDigit(digits9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits9[i]) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "X" : String(check);
}

/**
 * The normalized ISBN plus its ISBN-10/-13 counterpart when one exists.
 * Only the 978 prefix round-trips — 979-… ISBNs have no ISBN-10 form.
 * Anything that doesn't look like an ISBN comes back as just itself.
 */
export function isbnVariants(raw: string): string[] {
  const isbn = normalizeIsbn(raw);
  const variants = new Set([isbn]);

  if (/^978\d{10}$/.test(isbn)) {
    const core = isbn.slice(3, 12);
    variants.add(core + isbn10CheckDigit(core));
  } else if (/^\d{9}[\dX]$/.test(isbn)) {
    const core12 = "978" + isbn.slice(0, 9);
    variants.add(core12 + isbn13CheckDigit(core12));
  }

  return [...variants];
}
