/** Word lists for people's names, shared by the library's author sort
 *  (lib/library-sort.ts) and the names on book spines (lib/book-spine.ts). */

/** Surname particles that travel with the last name: "Le Guin" sorts under
 *  L, "van der Berg" under V. (Anglo-American shelving convention — Dutch
 *  libraries would file "van" under the bare surname instead.) */
export const SURNAME_PARTICLES = new Set([
  "da", "de", "del", "della", "den", "der", "di", "du", "la", "le",
  "mac", "mc", "st", "st.", "ten", "ter", "van", "von",
]);

/** Name suffixes that never lead a sort key. */
export const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);
