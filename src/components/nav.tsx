import Link from "next/link";
import {
  BookOpen,
  ChartColumn,
  HardDriveDownload,
  LibraryBig,
  LogOut,
  Plus,
} from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/theme-picker";

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. */
export async function Nav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      {/* Below sm the nav buttons collapse to icons so everything fits a
          phone screen without horizontal overflow. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-3 sm:gap-1 sm:px-4">
        <Link
          href="/books"
          className="mr-2 flex items-center gap-2 text-lg font-semibold tracking-tight sm:mr-4"
        >
          <BookOpen className="size-5" />
          <span className="hidden min-[400px]:inline">MyReads</span>
        </Link>
        <Button asChild variant="ghost" size="sm" title="Library">
          <Link href="/books">
            <LibraryBig data-slot="icon" />
            <span className="hidden sm:inline">Library</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" title="Add book">
          <Link href="/books/new">
            <Plus data-slot="icon" />
            <span className="hidden sm:inline">Add book</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" title="Stats">
          <Link href="/stats">
            <ChartColumn data-slot="icon" />
            <span className="hidden sm:inline">Stats</span>
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
          <span className="hidden text-sm text-muted-foreground md:inline">
            {session?.user?.name}
          </span>
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
