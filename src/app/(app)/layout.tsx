import { BackupReminder } from "@/components/backup-reminder";
import { CoverTilt } from "@/components/cover-tilt";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Nav } from "@/components/nav";
import { OwnCss } from "@/components/own-css";
import { PreferencesProvider } from "@/components/preferences-provider";
import { SoundUnlock } from "@/components/sounds";
import { ThemeSync } from "@/components/theme-sync";
import { getCurrentUser, getPreferences } from "@/lib/current-user";
import { parseThemeSetting, serializeThemeSetting } from "@/lib/themes";

/** Shared shell for all authenticated pages: top nav + centered content,
 *  and the keyboard shortcuts, which only show when ? asks for them. Last,
 *  the reader's own CSS, after everything else. */
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
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <BackupReminder />
        {children}
      </main>
      <KeyboardShortcuts />
      <SoundUnlock />
      <CoverTilt />
      <ThemeSync
        account={theme ? serializeThemeSetting(theme) : null}
        parts={JSON.stringify(prefs.partThemes)}
      />
      <OwnCss css={prefs.ownCss} />
    </PreferencesProvider>
  );
}
