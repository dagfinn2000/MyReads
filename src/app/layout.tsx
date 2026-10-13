import type { Metadata } from "next";
import "./globals.css";
import { Geist, Literata, Nunito } from "next/font/google";
import { BackgroundScene } from "@/components/background-scene";
import { getCurrentUser } from "@/lib/current-user";
import { serverTimeZone } from "@/lib/preferences";
import { skyAt, skyStyle } from "@/lib/sky";
import { cn } from "@/lib/utils";
import { DARK_THEME_IDS, THEME_INIT_SCRIPT, parseThemeSetting } from "@/lib/themes";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// A book face for the titles on drawn covers and the serif heading choice,
// and a rounded face for the other heading choice (Preferences). Not
// preloaded: the browser only fetches a face once something on the page
// uses it.
const literata = Literata({ subsets: ["latin"], variable: "--font-literata", preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", preload: false });

export const metadata: Metadata = {
  title: "MyReads",
  description: "Personal self-hosted library and reading tracker",
  // Installed-PWA polish on iOS (the manifest covers Android/desktop).
  appleWebApp: { capable: true, title: "MyReads", statusBarStyle: "default" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The signed-in user's saved theme, server-rendered onto <html> so a
  // fresh browser paints the right palette immediately. Signed-out pages
  // fall back to localStorage via the init script below. In automatic mode
  // only the browser knows whether the system is light or dark, so the
  // server sends the pair and the init script picks before first paint.
  //
  // Request-scoped cache: the page rendering inside this layout resolves the
  // same user, and both now share one session decode and one row read.
  const user = await getCurrentUser();
  const setting = parseThemeSetting(user?.theme);
  const prefs = user?.preferences;

  const themeAttrs =
    setting?.kind === "fixed"
      ? { "data-theme": setting.id }
      : setting?.kind === "auto"
        ? { "data-theme-auto": `${setting.light}:${setting.dark}` }
        : {};
  const dark = setting?.kind === "fixed" && DARK_THEME_IDS.includes(setting.id);
  // The Sky background's colours for right now, so the first paint already
  // shows the time of day (components/background-scene.tsx keeps it going).
  const sky =
    prefs?.background === "sky"
      ? skyStyle(skyAt(new Date(), prefs.timeZone || serverTimeZone()))
      : undefined;

  return (
    // suppressHydrationWarning: the theme init script mutates data-theme and
    // the dark class on <html> before React hydrates.
    <html
      lang="en"
      className={cn(
        "font-sans",
        geist.variable,
        literata.variable,
        nunito.variable,
        dark && "dark",
      )}
      {...themeAttrs}
      // Text size and fonts (Preferences); see globals.css.
      data-text-size={prefs?.textSize}
      data-long-font={prefs?.longTextFont}
      data-heading-font={prefs?.headingFont}
      // Appearance (Preferences); see globals.css.
      data-motion={prefs?.motion}
      data-covers={prefs?.coverArt}
      data-accent={prefs?.accent}
      data-corners={prefs?.corners}
      data-cards={prefs?.cardStyle}
      data-background={prefs?.background}
      data-background-motion={prefs?.backgroundMotion}
      data-book-backdrop={prefs?.bookBackdrop}
      // 3D covers, from the library's View menu.
      data-cover-3d={user?.libraryView.cover3d ? "" : undefined}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Applies the stored theme before first paint to avoid a flash of
            the default theme, and sets the browser's title bar colour to
            match. Must stay ahead of {children}. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <BackgroundScene
          background={prefs?.background ?? "plain"}
          timeZone={prefs?.timeZone ?? ""}
          sky={sky}
        />
        {children}
      </body>
    </html>
  );
}
