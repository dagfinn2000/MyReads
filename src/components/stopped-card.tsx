import Link from "next/link";
import { STOP_REASON_LABELS, type StopSummary } from "@/lib/stop-reasons";
import { BookCover } from "@/components/book-card";
import { BookLink } from "@/components/book-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DNF_HREF = "/books?shelf=DNF";

/**
 * "Why you stopped" on Stats (lib/stop-reasons.ts): the reasons given for
 * the books put down, how far in they were put down, the genres that come
 * up most among them, and the ones stopped for "not the right time", which
 * may be worth another go.
 */
export function StoppedCard({ summary: s, fmt }: { summary: StopSummary; fmt: (n: number) => string }) {
  const max = Math.max(...s.reasons.map((r) => r.count), 1);
  const given = s.reasons.some((r) => r.reason !== null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Why you stopped{" "}
          <span className="font-normal text-muted-foreground">
            · {fmt(s.total)} {s.total === 1 ? "book" : "books"} put down
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {given ? (
          <ul className="grid gap-2">
            {s.reasons.map((r) => (
              <li
                key={r.reason ?? "none"}
                className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm"
              >
                <span className="truncate text-muted-foreground">
                  {r.reason ? STOP_REASON_LABELS[r.reason] : "Not said"}
                </span>
                <span className="h-2.5 rounded-full bg-muted">
                  <span
                    className={
                      r.reason
                        ? "bar-grow block h-full rounded-full bg-linear-to-r from-primary/70 to-primary"
                        : "bar-grow block h-full rounded-full bg-muted-foreground/40"
                    }
                    style={{ width: `${Math.max((r.count / max) * 100, 2)}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{fmt(r.count)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            When you stop a book on Now reading you can say why, and the reasons add up here. A
            stopped book&apos;s page has the same menu.
          </p>
        )}

        {(s.averageShare !== null || s.tags.length > 0) && (
          <div className="grid gap-1 text-sm text-muted-foreground">
            {s.averageShare !== null && (
              <p>
                You put a book down{" "}
                <span className="font-medium text-foreground">
                  {fmt(Math.round(s.averageShare * 100))}%
                </span>{" "}
                of the way in, on average
                {s.early > 0 && (
                  <>
                    ; {fmt(s.early)} before a fifth
                  </>
                )}
                .
              </p>
            )}
            {s.tags.length > 0 && (
              <p>
                Most often put down:{" "}
                {s.tags.map((t, i) => (
                  <span key={t.tag}>
                    {i > 0 && ", "}
                    <Link
                      href={`${DNF_HREF}&tag=${encodeURIComponent(t.tag)}`}
                      prefetch={false}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {t.tag}
                    </Link>{" "}
                    ({fmt(t.count)})
                  </span>
                ))}
                .
              </p>
            )}
          </div>
        )}

        {s.anotherGo.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm text-muted-foreground">Not the right time, maybe now?</h3>
            <ul className="flex gap-3">
              {s.anotherGo.map((b) => (
                <li key={b.id} className="w-16 shrink-0">
                  <BookLink bookId={b.id} className="group grid gap-1" title={b.title}>
                    <BookCover
                      book={b}
                      className="aspect-[2/3] w-16"
                      stopped={{ page: b.currentPage, of: b.pageCount }}
                    />
                    <span className="line-clamp-2 text-xs leading-tight group-hover:underline">{b.title}</span>
                  </BookLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs">
          <Link
            href={DNF_HREF}
            prefetch={false}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            See the books you put down
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
