import Link from "next/link";
import { BookOpen, ChartColumn, LibraryBig, LogOut, Plus } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. */
export async function Nav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link
          href="/books"
          className="mr-4 flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <BookOpen className="size-5" />
          Bibliotek
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/books">
            <LibraryBig data-slot="icon" />
            Library
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/books/new">
            <Plus data-slot="icon" />
            Add book
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/stats">
            <ChartColumn data-slot="icon" />
            Stats
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
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
