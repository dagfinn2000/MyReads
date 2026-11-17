import { BackupReminder } from "@/components/backup-reminder";
import { CoverTilt } from "@/components/cover-tilt";
import { StickerSprite } from "@/components/cover-stickers";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Nav } from "@/components/nav";
import { OfflineProvider } from "@/components/offline-provider";
import { OwnCss } from "@/components/own-css";
import { PreferencesProvider } from "@/components/preferences-provider";
import { QuickFind } from "@/components/quick-find";
import { SoundUnlock } from "@/components/sounds";
import { ThemeSync } from "@/components/theme-sync";
import { buildId } from "@/lib/build-id";
import { getCurrentUser, getPreferences } from "@/lib/current-user";
import { START_PAGE_PATHS } from "@/lib/preferences";
import { parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

/** Shared shell for all authenticated pages: top nav + centered content,
 *  the keyboard shortcuts, which only show when ? asks for them, and quick
 *  find, which shows for Ctrl+K or the top bar's magnifier. Last,
 *  the reader's own CSS, after everything else. Around it all, what keeps
 *  the app going offline (components/offline-provider.tsx). */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const theme = parseThemeSetting(user?.theme);

  return (
    <PreferencesProvider
      value={prefs}
      detectTimeZone={!!user && user.preferences.timeZone === ""}
    >
      <OfflineProvider
        userId={user?.id ?? ""}
        swVersion={buildId()}
        startPath={START_PAGE_PATHS[prefs.startPage]}
      >
        {/* The stickers covers can wear, drawn once (cover-stickers.tsx). */}
        <StickerSprite />
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <BackupReminder />
          {children}
        </main>
        <KeyboardShortcuts />
        <QuickFind />
        <SoundUnlock />
        <CoverTilt />
        <ThemeSync
          account={theme ? serializeThemeSetting(theme) : null}
          parts={JSON.stringify(prefs.partThemes)}
        />
        <OwnCss css={prefs.ownCss} />
      </OfflineProvider>
    </PreferencesProvider>
  );
}
