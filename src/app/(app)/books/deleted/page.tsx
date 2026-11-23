import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPreferences, getSession } from "@/lib/current-user";
import { formatDate } from "@/lib/display";
import { fineText } from "@/lib/fine-type";
import { BIN_DAYS, binCutoff, binExpiry, forgetExpired } from "@/lib/recently-deleted";
import { BookCover } from "@/components/book-card";
import { BinRowActions, EmptyBinButton } from "@/components/recently-deleted-actions";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recently deleted · MyReads" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Goes for good in 12 days", "tomorrow", "today". */
function goesIn(expiry: Date, now: Date): string {
  const days = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
  if (days <= 1) return days <= 0 ? "Goes for good today" : "Goes for good tomorrow";
  return `Goes for good in ${days} days`;
}

/**
 * Recently deleted: books deleted in the last 30 days, newest first, each
 * ready to be put back as it was (lib/recently-deleted.ts) or deleted for
 * good now.
 */
export default async function RecentlyDeletedPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const prefs = await getPreferences();
  const now = new Date();

  // Whatever's had its time goes now, rather than waiting for the server's
  // hourly sweep.
  await forgetExpired(now).catch(() => 0);
  const entries = await prisma.deletedBook.findMany({
    where: { userId, deletedAt: { gte: binCutoff(now) } },
    select: { id: true, title: true, authors: true, coverUrl: true, deletedAt: true },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Recently deleted</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Deleted books wait here for {BIN_DAYS} days with their reading history, notes, quotes and
            loans. Put one back and it’s just as it was, on the same shelves.
          </p>
        </div>
        {entries.length > 0 && <EmptyBinButton count={entries.length} />}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Trash2 className="size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="font-medium">Nothing here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              A book you delete stays here for {BIN_DAYS} days, in case you want it back.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="grid divide-y">
              {entries.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <BookCover book={b} className="aspect-[2/3] w-12 shrink-0" />
                  <span className="grid min-w-0 flex-1 basis-48 gap-0.5 text-sm">
                    <span className="truncate font-medium">{fineText(b.title)}</span>
                    {b.authors.length > 0 && (
                      <span className="truncate text-muted-foreground">{fineText(b.authors.join(", "))}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Deleted {formatDate(b.deletedAt, prefs)} · {goesIn(binExpiry(b.deletedAt), now)}
                    </span>
                  </span>
                  <BinRowActions id={b.id} title={b.title} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
