import Link from "next/link";
import {
  BookOpen,
  ChartColumn,
  HardDriveDownload,
  LibraryBig,
  LogOut,
  Plus,
  Quote,
  ScanSearch,
  UserRound,
} from "lucide-react";
import { auth, signOut } from "@/auth";
import { getPreferences } from "@/lib/current-user";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/theme-picker";

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. The Check and
 *  Quotes links can be hidden in Preferences; the logo goes to the start
 *  page chosen there. */
export async function Nav() {
  const [session, prefs] = await Promise.all([auth(), getPreferences()]);
  const hidden = new Set(prefs.hiddenNav);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      {/* Below lg the nav buttons collapse to icons. With five labelled
          links plus the right-hand group the bar needs about 900px, so
          labels from sm (640px) overflowed tablets and narrow windows. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-3 sm:gap-1 sm:px-4">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 text-lg font-semibold tracking-tight sm:mr-4"
        >
          <BookOpen className="size-5" />
          <span className="hidden min-[400px]:inline">MyReads</span>
        </Link>
        <Button asChild variant="ghost" size="sm" title="Library">
          <Link href="/books">
            <LibraryBig data-slot="icon" />
            <span className="hidden lg:inline">Library</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" title="Add book">
          <Link href="/books/new">
            <Plus data-slot="icon" />
            <span className="hidden lg:inline">Add book</span>
          </Link>
        </Button>
        {!hidden.has("check") && (
          <Button asChild variant="ghost" size="sm" title="Do I own this?">
            <Link href="/books/check">
              <ScanSearch data-slot="icon" />
              <span className="hidden lg:inline">Check</span>
            </Link>
          </Button>
        )}
        {!hidden.has("quotes") && (
          <Button asChild variant="ghost" size="sm" title="Quotes">
            <Link href="/quotes">
              <Quote data-slot="icon" />
              <span className="hidden lg:inline">Quotes</span>
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" title="Stats">
          <Link href="/stats">
            <ChartColumn data-slot="icon" />
            <span className="hidden lg:inline">Stats</span>
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            title="Download library backup (zip incl. covers)"
          >
            {/* Plain <a>: this is a file download, not a client navigation. */}
            <a href="/api/export">
              <HardDriveDownload data-slot="icon" />
              <span className="sr-only">Download library backup</span>
            </a>
          </Button>
          <ThemePicker />
          <Button asChild variant="ghost" size="sm" title="Account">
            <Link href="/account">
              <UserRound data-slot="icon" />
              <span className="hidden text-muted-foreground xl:inline">
                {session?.user?.name}
              </span>
            </Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm" title="Sign out">
              <LogOut data-slot="icon" />
              <span className="sr-only">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
