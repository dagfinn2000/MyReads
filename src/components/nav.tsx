import Link from "next/link";
import {
  Armchair,
  BookCopy,
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
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/auth";
import { getPreferences, getSession } from "@/lib/current-user";
import { NAV_LINKS, ROOMY_NAV_LINKS, topBarLinks } from "@/lib/nav";
import type { NavItem } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import { ThemePicker } from "@/components/theme-picker";

const NAV_ICONS: Record<NavItem, LucideIcon> = {
  library: LibraryBig,
  reading: BookOpenText,
  add: Plus,
  check: ScanSearch,
  quotes: Quote,
  stats: ChartColumn,
  room: Armchair,
  series: BookCopy,
};

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. The links come in
 *  the order chosen in Preferences, where Now reading, Check, Quotes and
 *  Reading room can be hidden and Series added; the logo goes to the start
 *  page chosen there. */
export async function Nav() {
  const [session, prefs] = await Promise.all([getSession(), getPreferences()]);
  const links = topBarLinks(prefs);
  const crowded = links.length > ROOMY_NAV_LINKS;

  return (
    <header className="top-bar sticky top-0 z-40 border-b bg-background/75 backdrop-blur-md backdrop-saturate-150">
      {/* Below lg the nav buttons collapse to icons. With seven labelled
          links plus the right-hand group the bar needs about 1000px, so
          labels from sm (640px) overflowed tablets and narrow windows.
          On phones the icons sit closer together and the wordmark waits
          for room, so the bar fits from 360px up with every link shown.
          An eighth link (Series) needs another 80px or so with its label
          and 28px as an icon, so then the labels wait for 1120px and,
          below 400px, the icons close up by a pixel each side. The phone
          paddings are two ranges, not one overriding the other: Tailwind
          puts max-[400px] ahead of max-sm, so max-sm would win. */}
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-3 sm:gap-1 sm:px-4",
          crowded
            ? "max-[400px]:[&_[data-slot=button]]:px-1 min-[400px]:max-sm:[&_[data-slot=button]]:px-[5px]"
            : "max-sm:[&_[data-slot=button]]:px-[5px]",
        )}
      >
        <Link
          href="/"
          className="wordmark mr-1 flex items-center gap-2 text-lg sm:mr-4"
        >
          <BookOpen className="size-5" />
          <span className="hidden min-[480px]:inline">MyReads</span>
        </Link>
        {links.map((item) => {
          const { href, label, title } = NAV_LINKS[item];
          const Icon = NAV_ICONS[item];
          return (
            <NavLink key={item} href={href} title={title}>
              <Icon data-slot="icon" />
              <span className={crowded ? "hidden min-[1120px]:inline" : "hidden lg:inline"}>
                {label}
              </span>
            </NavLink>
          );
        })}
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
