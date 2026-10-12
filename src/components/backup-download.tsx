"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardDriveDownload } from "lucide-react";
import { getLastBackupAt } from "@/lib/actions/backup";
import { savePreferences } from "@/lib/actions/preferences";
import type { BackupReminder } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const POLL_MS = 2000;
const POLL_TRIES = 30; // a minute

/**
 * Watches for a download to finish. A download is a plain link the browser
 * saves on its own, so the page never hears that it's done; instead, after
 * `start()`, this asks the server every 2 seconds (for up to a minute)
 * whether the account's last backup date has moved past `lastBackupAt`,
 * and refreshes the page once it has.
 */
export function useBackupWatch(lastBackupAt: string | null) {
  const router = useRouter();
  // 0 while idle; bumped per click, so a second click restarts the minute.
  const [round, setRound] = useState(0);
  // The date the page showed when the download started.
  const baseline = useRef(lastBackupAt);

  useEffect(() => {
    if (round === 0) return;
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      tries++;
      let latest: string | null;
      try {
        latest = await getLastBackupAt();
      } catch {
        // Signed out, or the server is unreachable: stop quietly.
        if (!stopped) setRound(0);
        return;
      }
      if (stopped) return;
      if (latest !== baseline.current) {
        setRound(0);
        router.refresh();
      } else if (tries >= POLL_TRIES) {
        setRound(0);
      } else {
        timer = setTimeout(tick, POLL_MS);
      }
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [round, router]);

  const start = useCallback(() => {
    baseline.current = lastBackupAt;
    setRound((r) => r + 1);
  }, [lastBackupAt]);

  return { watching: round > 0, start };
}

/** The Backup card's download link. Still a plain link, so it works
 *  without JavaScript; with it, the card's date updates once the zip is
 *  saved. */
export function BackupDownloadButton({ lastBackupAt }: { lastBackupAt: string | null }) {
  const { watching, start } = useBackupWatch(lastBackupAt);

  return (
    <span className="inline-flex items-center">
      <Button asChild variant="outline" size="sm">
        <a href="/api/export" onClick={start}>
          <HardDriveDownload data-slot="icon" />
          Download backup
        </a>
      </Button>
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {watching && <span className="pl-2">Downloading…</span>}
      </span>
    </span>
  );
}

/** "Remind me to back up" on the Backup card. Saves as it changes, like
 *  the Preferences card. */
export function BackupReminderSetting({ initial }: { initial: BackupReminder }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  function change(next: BackupReminder) {
    setValue(next);
    setStatus("saving");
    startTransition(async () => {
      try {
        await savePreferences({ backupReminder: next });
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">Remind me to back up</p>
        <p className="text-xs text-muted-foreground">
          A note on the Library and Stats pages when your last download is more than a month
          old.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Select value={value} onValueChange={(v) => change(v as BackupReminder)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Remind me to back up">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="monthly">Every month</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Saved."
              : status === "error"
                ? "Couldn't save that change. Try again."
                : ""}
        </p>
      </div>
    </div>
  );
}
