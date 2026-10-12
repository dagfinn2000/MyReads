import { redirect } from "next/navigation";
import { HardDriveDownload } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getPreferences } from "@/lib/current-user";
import { backupStatusText } from "@/lib/backup";
import { formatDate, formatNumber } from "@/lib/display";
import { orderByIds } from "@/lib/library-order";
import { googleBooksEnabled } from "@/lib/metadata/googlebooks";
import { DEFAULT_PREFERENCES, serverTimeZone } from "@/lib/preferences";
import { BackupDownloadButton, BackupReminderSetting } from "@/components/backup-download";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccount } from "@/components/delete-account";
import { PreferencesForm } from "@/components/preferences-form";
import { RestoreBackup } from "@/components/restore-backup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account · MyReads" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;

  const [user, bookCount, current, prefs, savedViews] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, createdAt: true, lastBackupAt: true },
    }),
    prisma.book.count({ where: { userId } }),
    getCurrentUser(),
    getPreferences(),
    prisma.savedView.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!user) return null;
  // As stored, so the form can tell "never set" from a chosen zone.
  const stored = current?.preferences ?? DEFAULT_PREFERENCES;
  const timeZones = [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Member since {formatDate(user.createdAt, prefs)} ·{" "}
            {formatNumber(bookCount, prefs)} book{bookCount === 1 ? "" : "s"} in
            the library
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Keyed on the zone: the first visit fills it in from the
              browser, and the form should show the zone it picked. */}
          <PreferencesForm
            key={stored.timeZone}
            initial={stored}
            serverTimeZone={serverTimeZone()}
            timeZones={timeZones}
            googleAvailable={googleBooksEnabled()}
            savedViews={orderByIds(savedViews, prefs.savedViewOrder)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* scroll-mt clears the sticky top bar for /account#backup, where
          the backup reminder links. */}
      <Card id="backup" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Backup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Download your library (books, quotes, shelves, goals — cover
            images included) as a zip, or restore a backup (zip, or JSON
            from older versions). Restoring merges: books you already have
            are skipped.
          </p>
          <p className="text-sm" aria-live="polite">
            {backupStatusText(user.lastBackupAt, new Date(), prefs)}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <BackupDownloadButton lastBackupAt={user.lastBackupAt?.toISOString() ?? null} />
            <RestoreBackup />
          </div>
          <BackupReminderSetting initial={stored.backupReminder} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes your entire library from this
            instance — permanently. A backup zip restores into any MyReads
            instance, so grab one first if there&apos;s any doubt.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/export">
                <HardDriveDownload data-slot="icon" />
                Download backup
              </a>
            </Button>
            <DeleteAccount bookCount={bookCount} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
