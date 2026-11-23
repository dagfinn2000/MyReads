import Link from "next/link";
import { BookOpen, HardDriveDownload, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/auth";
import { getPreferences, getSession } from "@/lib/current-user";
import { NAV_LINKS, ROOMY_NAV_LINKS, topBarLinks } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NAV_ICONS } from "@/components/nav-icons";
import { NavLink } from "@/components/nav-link";
import { QuickFindButton } from "@/components/quick-find";
import { SyncStatus } from "@/components/sync-status";
import { ThemePicker } from "@/components/theme-picker";

/** Top navigation for authenticated pages. Server component — reads the
 *  session directly and signs out via a server action. The links come in
 *  the order chosen in Preferences, where Now reading, Check, Quotes and
 *  Reading room can be hidden and Series added; the logo goes to the start
 *  page chosen there. */
export async function Nav() {
  const [session, prefs] = await Promise.all([getSession(), getPreferences()]);
  const links = topBarLinks(prefs);
  const crowded = links.length > ROOMY_NAV_LINKS;
  // A ninth link (Series and Authors both on) needs a few pixels more again.
  const packed = links.length > ROOMY_NAV_LINKS + 1;

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
          puts max-[400px] ahead of max-sm, so max-sm would win. A ninth
          (Authors as well) waits for 1200px, the links close up again
          below 420px and up to 720px, and the account name stays out.
          When the row is still too wide, as with a restyled theme's
          bigger buttons or on a 320px phone, the links give up some of
          their padding to make room (globals.css, "Top bar"). */}
      <div
        role="navigation"
        aria-label="Main"
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-3 sm:gap-1 sm:px-4",
          packed
            ? "max-[420px]:gap-0 max-[420px]:[&_[data-slot=button]]:px-[3px] min-[420px]:max-sm:[&_[data-slot=button]]:px-[5px] sm:max-[720px]:[&_[data-slot=button]]:px-[6px]"
            : crowded
              ? "max-[400px]:[&_[data-slot=button]]:px-1 min-[400px]:max-sm:[&_[data-slot=button]]:px-[5px]"
              : "max-sm:[&_[data-slot=button]]:px-[5px]",
        )}
      >
        <Link
          href="/"
          className="wordmark mr-1 flex items-center gap-2 text-lg sm:mr-4"
        >
          <BookOpen className="size-5" />
          <span className={packed ? "hidden min-[500px]:inline" : "hidden min-[480px]:inline"}>
            MyReads
          </span>
        </Link>
        {links.map((item) => {
          const { href, label, title } = NAV_LINKS[item];
          const Icon = NAV_ICONS[item];
          return (
            <NavLink key={item} href={href} title={title}>
              <Icon data-slot="icon" />
              <span
                className={
                  packed
                    ? "hidden min-[1200px]:inline"
                    : crowded
                      ? "hidden min-[1120px]:inline"
                      : "hidden lg:inline"
                }
              >
                {label}
              </span>
            </NavLink>
          );
        })}
        <div
          className={cn(
            "ml-auto flex items-center gap-0.5",
            // Labelled, nine links leave less room between these.
            packed ? "sm:max-[1199px]:gap-3 min-[1200px]:gap-1.5" : "sm:gap-3",
          )}
        >
          {/* Only while offline, or while reading waits to be sent. */}
          <SyncStatus />
          {/* Where the bar has room for it: phones have the library's
              search box instead. */}
          <QuickFindButton className="max-md:hidden" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            // The Account page's Backup card has it too, for the narrowest
            // phones, where nine links leave no room for it.
            className={cn("backup-link", packed && "max-[339px]:hidden")}
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
              {/* With eight links or more the bar has no room for the name
                  at any width: it never grows past max-w-6xl. */}
              <span className={cn("hidden text-muted-foreground", !crowded && "xl:inline")}>
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
