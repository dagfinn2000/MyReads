import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { DARK_THEME_IDS, THEME_INIT_SCRIPT } from "@/lib/themes";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MyReads",
  description: "Self-hosted personal book library",
  // Installed-PWA polish on iOS (the manifest covers Android/desktop).
  appleWebApp: { capable: true, title: "MyReads", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The signed-in user's saved theme, server-rendered onto <html> so a
  // fresh browser paints the right palette immediately. Signed-out pages
  // fall back to localStorage via the init script below.
  let theme: string | null = null;
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { theme: true },
    });
    theme = user?.theme ?? null;
  }
  const dark = theme !== null && DARK_THEME_IDS.includes(theme);

  return (
    // suppressHydrationWarning: the theme init script mutates data-theme and
    // the dark class on <html> before React hydrates.
    <html
      lang="en"
      className={cn("font-sans", geist.variable, dark && "dark")}
      {...(theme !== null && { "data-theme": theme })}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Applies the stored theme before first paint to avoid a flash of
            the default theme. Must stay ahead of {children}. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
