import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { getCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { DARK_THEME_IDS, THEME_INIT_SCRIPT, parseThemeSetting } from "@/lib/themes";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MyReads",
  description: "Self-hosted personal book library",
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

  return (
    // suppressHydrationWarning: the theme init script mutates data-theme and
    // the dark class on <html> before React hydrates.
    <html
      lang="en"
      className={cn("font-sans", geist.variable, dark && "dark")}
      {...themeAttrs}
      // Text size and the long-text font (Preferences); see globals.css.
      data-text-size={prefs?.textSize}
      data-long-font={prefs?.longTextFont}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Applies the stored theme before first paint to avoid a flash of
            the default theme, and sets the browser's title bar colour to
            match. Must stay ahead of {children}. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
