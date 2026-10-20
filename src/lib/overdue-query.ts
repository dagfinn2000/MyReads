import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/display";
import { isOverdue, overdueCutoff, overdueText, type OverdueLoan } from "@/lib/loans";
import type { Preferences } from "@/lib/preferences";

/** "Not now" on the overdue reminder hides it in this browser for a few
 *  days; the cookie holds the id of the account that snoozed it. */
export const OVERDUE_SNOOZE_COOKIE = "myreads-overdue-snooze";
export const OVERDUE_SNOOZE_DAYS = 3;

/** An open loan as the reminder needs it. */
export interface OpenLoan {
  bookId: string;
  borrower: string;
  lentAt: Date;
  dueAt: Date | null;
}

/**
 * The overdue reminder on the Library and Now reading pages: which lent
 * books are past the day they were due back, as one line and a link. Null
 * when nothing is overdue, the reminder is off, or it was snoozed.
 *
 * The Library already has its open loans and passes them in; Now reading
 * doesn't, and asks for just the overdue ones. Book titles are fetched only
 * when something is overdue.
 */
export async function overdueReminder(
  userId: string,
  prefs: Pick<Preferences, "overdueReminder" | "timeZone" | "dateFormat">,
  openLoans?: OpenLoan[],
): Promise<{ message: string; href: string } | null> {
  if (!prefs.overdueReminder) return null;
  const now = new Date();
  const jar = await cookies();
  if (jar.get(OVERDUE_SNOOZE_COOKIE)?.value === userId) return null;

  const loans =
    openLoans ??
    (await prisma.loan.findMany({
      where: { returnedAt: null, dueAt: { lt: overdueCutoff(now, prefs.timeZone) }, book: { userId } },
      select: { bookId: true, borrower: true, lentAt: true, dueAt: true },
    }));
  const overdue = loans
    .filter((l) => isOverdue(l.dueAt, now, prefs.timeZone))
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  if (overdue.length === 0) return null;

  const titles = new Map(
    (
      await prisma.book.findMany({
        where: { userId, id: { in: overdue.map((l) => l.bookId) } },
        select: { id: true, title: true },
      })
    ).map((b) => [b.id, b.title]),
  );
  const named: OverdueLoan[] = overdue.flatMap((l) => {
    const title = titles.get(l.bookId);
    return title ? [{ bookId: l.bookId, title, borrower: l.borrower }] : [];
  });
  const message = overdueText(
    named,
    named.length === 1 ? formatDate(overdue[0].lentAt, prefs) : undefined,
  );
  if (!message) return null;
  return {
    message,
    href: named.length === 1 ? `/books/${named[0].bookId}` : "/books?owned=overdue",
  };
}
