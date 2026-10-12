import { BackupReminder } from "@/components/backup-reminder";
import { Nav } from "@/components/nav";
import { PreferencesProvider } from "@/components/preferences-provider";
import { getCurrentUser, getPreferences } from "@/lib/current-user";

/** Shared shell for all authenticated pages: top nav + centered content. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);

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
    </PreferencesProvider>
  );
}
