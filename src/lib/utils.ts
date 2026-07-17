import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Lowercased title+authors+series blob stored on Book.searchText: makes
 *  case-insensitive search a single `contains` query (Prisma can't
 *  substring-search a String[] column). Shared by the book actions and the
 *  backup import so the two can never drift. */
export function buildSearchText(
  title: string,
  authors: string[],
  seriesName?: string | null,
): string {
  return [title, ...authors, seriesName ?? ""].join(" ").trim().toLowerCase();
}
