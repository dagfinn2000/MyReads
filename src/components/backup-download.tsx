"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, HardDriveDownload } from "lucide-react";
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

/** The newest copies listed straight away; any more wait behind "Show". */
const SHOWN_COPIES = 7;

export interface ServerBackupRow {
  /** The file's name, which is also its address under /api/backups. */
  name: string;
  /** The day it was made, in the reader's date style. */
  date: string;
  /** Its size, ready to show. */
  size: string;
}

/**
 * The nightly copies on the server, on the Backup card when server backups
 * are on: when they're made and how many are kept, then each copy newest
 * first with a link to download it. A download counts as a backup made,
 * like the button's, so the card's date updates the same way.
 */
export function ServerBackupList({
  note,
  copies,
  lastBackupAt,
}: {
  note: string;
  copies: ServerBackupRow[];
  lastBackupAt: string | null;
}) {
  const { watching, start } = useBackupWatch(lastBackupAt);
  const [clicked, setClicked] = useState<string | null>(null);

  const row = (copy: ServerBackupRow) => (
    <li key={copy.name} className="flex min-h-10 items-center gap-3 py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 truncate">{copy.date}</span>
      <span aria-live="polite" className="text-muted-foreground tabular-nums">
        {watching && clicked === copy.name ? "Downloading…" : copy.size}
      </span>
      <Button asChild variant="ghost" size="sm">
        <a
          href={`/api/backups/${copy.name}`}
          aria-label={`Download the copy from ${copy.date}`}
          onClick={() => {
            setClicked(copy.name);
            start();
          }}
        >
          <Download data-slot="icon" />
          Download
        </a>
      </Button>
    </li>
  );
  const listClass = "divide-y rounded-lg border text-sm";
  const older = copies.slice(SHOWN_COPIES);

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        {note}
        {copies.length === 0 && " No copies saved yet."}
      </p>
      {copies.length > 0 && (
        <ul aria-label="Copies saved on the server" className={listClass}>
          {copies.slice(0, SHOWN_COPIES).map(row)}
        </ul>
      )}
      {older.length > 0 && (
        <details>
          <summary className="w-fit cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {older.length === 1 ? "Show 1 older copy" : `Show ${older.length} older copies`}
          </summary>
          <ul aria-label="Older copies" className={`mt-2 ${listClass}`}>
            {older.map(row)}
          </ul>
        </details>
      )}
    </div>
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
