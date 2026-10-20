"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { snoozeOverdueReminder } from "@/lib/actions/loans";
import { Button } from "@/components/ui/button";

/**
 * "Dune is overdue. Kari has had it since 3 September." The server has
 * already decided something is overdue (lib/overdue-query.ts); this draws
 * the line with a way to the book and a way to put it off.
 */
export function OverdueNotice({
  message,
  href,
  several,
}: {
  message: string;
  href: string;
  /** Several books: the link opens the library's Overdue filter. */
  several: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <aside
      aria-label="Overdue books"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-red-300 bg-card px-3 py-2 text-sm dark:border-red-900"
    >
      <CalendarClock className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
      {/* At least 12rem, so on a phone the buttons wrap under the line
          rather than squeezing it into a narrow column. */}
      <span className="min-w-48 flex-1">{message}</span>
      <span className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>{several ? "See them" : "Open the book"}</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => snoozeOverdueReminder())}
        >
          Not now
        </Button>
      </span>
    </aside>
  );
}
