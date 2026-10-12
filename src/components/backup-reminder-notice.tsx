"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDriveDownload } from "lucide-react";
import { snoozeBackupReminder } from "@/lib/actions/backup";
import { useBackupWatch } from "@/components/backup-download";
import { Button } from "@/components/ui/button";

/** The Library and Stats pages; not a book page, Add, Quotes or Account. */
const SHOWN_ON = new Set(["/books", "/stats"]);

/**
 * The monthly backup reminder. The server has already decided it's due
 * (see BackupReminder); this only picks the pages it shows on, so it never
 * flashes in after load.
 */
export function BackupReminderNotice({
  message,
  lastBackupAt,
}: {
  message: string;
  lastBackupAt: string | null;
}) {
  const pathname = usePathname();
  const shown = SHOWN_ON.has(pathname);
  const [pending, startTransition] = useTransition();
  const { start } = useBackupWatch(lastBackupAt);

  // A download from the top bar's backup icon should clear the reminder
  // too. The shell layout doesn't re-render on its own, so watch for it.
  useEffect(() => {
    if (!shown) return;
    function onClick(e: MouseEvent) {
      if (e.target instanceof Element && e.target.closest('a[href="/api/export"]')) start();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [shown, start]);

  if (!shown) return null;
  return (
    <aside
      aria-label="Backup reminder"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 text-sm"
    >
      <HardDriveDownload className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      <span className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/account#backup">Go to Backup</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => snoozeBackupReminder())}
        >
          Not now
        </Button>
      </span>
    </aside>
  );
}
