import Link from "next/link";
import {
  Armchair,
  BookOpen,
  BookOpenText,
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
import { NavLink } from "@/components/nav-link";
import { ThemePicker } from "@/components/theme-picker";

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. The Now reading,
 *  Check, Quotes and Reading room links can be hidden in Preferences; the
 *  logo goes to the start page chosen there. */
export async function Nav() {
  const [session, prefs] = await Promise.all([auth(), getPreferences()]);
  const hidden = new Set(prefs.hiddenNav);

  return (
    <header className="top-bar sticky top-0 z-40 border-b bg-background/75 backdrop-blur-md backdrop-saturate-150">
      {/* Below lg the nav buttons collapse to icons. With seven labelled
          links plus the right-hand group the bar needs about 1000px, so
          labels from sm (640px) overflowed tablets and narrow windows.
          On phones the icons sit closer together and the wordmark waits
          for room, so the bar fits from 360px up with every link shown. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-3 max-sm:[&_[data-slot=button]]:px-[5px] sm:gap-1 sm:px-4">
        <Link
          href="/"
          className="wordmark mr-1 flex items-center gap-2 text-lg sm:mr-4"
        >
          <BookOpen className="size-5" />
          <span className="hidden min-[480px]:inline">MyReads</span>
        </Link>
        <NavLink href="/books" title="Library">
          <LibraryBig data-slot="icon" />
          <span className="hidden lg:inline">Library</span>
        </NavLink>
        {!hidden.has("reading") && (
          <NavLink href="/reading" title="Now reading">
            <BookOpenText data-slot="icon" />
            <span className="hidden lg:inline">Now reading</span>
          </NavLink>
        )}
        <NavLink href="/books/new" title="Add book">
          <Plus data-slot="icon" />
          <span className="hidden lg:inline">Add book</span>
        </NavLink>
        {!hidden.has("check") && (
          <NavLink href="/books/check" title="Do I own this?">
            <ScanSearch data-slot="icon" />
            <span className="hidden lg:inline">Check</span>
          </NavLink>
        )}
        {!hidden.has("quotes") && (
          <NavLink href="/quotes" title="Quotes">
            <Quote data-slot="icon" />
            <span className="hidden lg:inline">Quotes</span>
          </NavLink>
        )}
        <NavLink href="/stats" title="Stats">
          <ChartColumn data-slot="icon" />
          <span className="hidden lg:inline">Stats</span>
        </NavLink>
        {!hidden.has("room") && (
          <NavLink href="/room" title="Reading room">
            <Armchair data-slot="icon" />
            <span className="hidden lg:inline">Room</span>
          </NavLink>
        )}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-3">
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
