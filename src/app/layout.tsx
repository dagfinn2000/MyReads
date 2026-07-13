import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { THEME_INIT_SCRIPT } from "@/lib/themes";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the theme init script mutates data-theme and
    // the dark class on <html> before React hydrates.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Applies the stored theme before first paint to avoid a flash of
            the default theme. Must stay ahead of {children}. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
