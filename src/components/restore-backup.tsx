"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HardDriveUpload, Loader2 } from "lucide-react";
import type { ImportSummary } from "@/lib/import";
import { Button } from "@/components/ui/button";

/**
 * "Restore backup" button on the account page: picks a MyReads export (zip
 * with covers, or a legacy JSON), posts it to /api/import, and reports what
 * was merged in.
 */
export function RestoreBackup() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function restore(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: file,
      });
      const data = (await res.json()) as ImportSummary & { error?: string };
      if (!res.ok || data.error) {
        setMessage(data.error ?? "Restore failed.");
        return;
      }
      // "1 cover", "2 covers"; "1 past read", "2 past reads".
      const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
      const parts = [
        `${n(data.booksCreated, "book")} restored`,
        data.booksSkipped > 0 ? `${data.booksSkipped} already present` : null,
        data.booksInvalid > 0 ? `${data.booksInvalid} invalid` : null,
        data.coversRestored > 0 ? `${n(data.coversRestored, "cover")} restored` : null,
        data.quotesRestored > 0 ? `${n(data.quotesRestored, "quote")} restored` : null,
        data.readsRestored > 0 ? `${n(data.readsRestored, "past read")} restored` : null,
        data.progressRestored > 0 ? `${n(data.progressRestored, "progress entry", "progress entries")} restored` : null,
        data.loansRestored > 0 ? `${n(data.loansRestored, "loan")} restored` : null,
        data.shelvesCreated > 0 ? `${n(data.shelvesCreated, "shelf", "shelves")} created` : null,
        data.goalsRestored > 0 ? `${n(data.goalsRestored, "goal")} restored` : null,
        data.savedViewsRestored > 0 ? `${n(data.savedViewsRestored, "saved view")} restored` : null,
        data.settingsRestored ? "settings restored" : null,
      ].filter(Boolean);
      // A restore that stopped early must not read as a clean success — say
      // what landed and that re-running finishes the job (already-restored
      // books are skipped as duplicates).
      setMessage(
        data.incomplete
          ? `${parts.join(", ")} — then stopped early (${data.incomplete.reason}). ` +
            `Run the restore again to continue where it left off.`
          : `${parts.join(", ")}.`,
      );
      router.refresh();
    } catch {
      setMessage("Restore failed — is this a MyReads export file?");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 data-slot="icon" className="animate-spin" />
          ) : (
            <HardDriveUpload data-slot="icon" />
          )}
          Restore backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/zip,.zip,application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
          }}
        />
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
