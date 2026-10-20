/**
 * The database's enums (prisma/schema.prisma), as plain objects.
 *
 * Importing an enum's value from "@prisma/client" in anything the browser
 * runs pulls in Prisma's whole browser build (Decimal.js and every model's
 * field lists, ~40 KB) just to read a few strings. These are the same
 * values with the same types, so they can be passed to and from Prisma
 * freely; enums.test.ts fails if one drifts from the schema.
 *
 * Import enum values from here, everywhere. Types alone can still come from
 * "@prisma/client" (eslint.config.mjs enforces both).
 */

export const ReadingStatus = {
  WANT_TO_READ: "WANT_TO_READ",
  READING: "READING",
  READ: "READ",
  DNF: "DNF",
} as const;
export type ReadingStatus = (typeof ReadingStatus)[keyof typeof ReadingStatus];

export const BookFormat = {
  PHYSICAL: "PHYSICAL",
  EBOOK: "EBOOK",
  AUDIOBOOK: "AUDIOBOOK",
} as const;
export type BookFormat = (typeof BookFormat)[keyof typeof BookFormat];

export const BookOwnership = {
  OWNED: "OWNED",
  WISHLIST: "WISHLIST",
  BORROWED: "BORROWED",
  GIVEN_AWAY: "GIVEN_AWAY",
} as const;
export type BookOwnership = (typeof BookOwnership)[keyof typeof BookOwnership];

export const GoalUnit = {
  BOOKS: "BOOKS",
  PAGES: "PAGES",
  DAYS: "DAYS",
} as const;
export type GoalUnit = (typeof GoalUnit)[keyof typeof GoalUnit];

export const GoalSpan = {
  YEAR: "YEAR",
  MONTH: "MONTH",
} as const;
export type GoalSpan = (typeof GoalSpan)[keyof typeof GoalSpan];
