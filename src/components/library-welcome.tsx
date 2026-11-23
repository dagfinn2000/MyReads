"use client";

import Link from "next/link";
import { ArchiveRestore, Palette, ScanBarcode } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OPEN_THEME_PICKER_EVENT } from "@/lib/theme-picker-event";
import { Button } from "@/components/ui/button";

/**
 * What an empty library shows: a welcome with three ways to start. Add
 * books (a whole shelf by barcode, if you like), bring a library over
 * from a backup, or pick a look from the top bar's theme menu.
 */
export function LibraryWelcome({ themeCount }: { themeCount: number }) {
  return (
    <section
      aria-labelledby="welcome-title"
      className="grid gap-6 rounded-xl border bg-card px-5 py-8 text-center shadow-xs sm:px-8 sm:py-10"
      data-library-view=""
    >
      <div className="grid justify-items-center gap-2">
        <h2 id="welcome-title" className="text-2xl font-semibold tracking-tight text-balance">
          Welcome to MyReads
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-balance">
          Your library is empty for now. Here are three ways to begin; everything else waits in
          Preferences on the Account page.
        </p>
      </div>
      <ol className="grid gap-4 text-left sm:grid-cols-3">
        <Step
          n={1}
          icon={ScanBarcode}
          title="Add your books"
          text="Search by title, author or ISBN, or scan the barcodes along a whole shelf with your phone’s camera."
          action={
            <Button asChild size="sm">
              <Link href="/books/new">Add a book</Link>
            </Button>
          }
        />
        <Step
          n={2}
          icon={ArchiveRestore}
          title="Bring a library with you"
          text="Moving from another MyReads server? Restore its backup zip, covers, notes and all."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/account#backup">Restore a backup</Link>
            </Button>
          }
        />
        <Step
          n={3}
          icon={Palette}
          title="Pick a look"
          text={`${themeCount} themes, light and dark, from plain paper to a 1995 desktop. Change it whenever you like.`}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.dispatchEvent(new Event(OPEN_THEME_PICKER_EVENT))}
            >
              Choose a theme
            </Button>
          }
        />
      </ol>
    </section>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  text,
  action,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <li className="grid grid-rows-[auto_auto_1fr_auto] gap-2 rounded-lg border bg-background/60 p-4">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-5 text-primary" aria-hidden />
        <span className="text-xs tabular-nums" aria-hidden>
          {n}
        </span>
      </span>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="pt-1">{action}</div>
    </li>
  );
}
