import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordBackupDownload } from "@/lib/backup-zip";
import { serverBackupConfig } from "@/lib/server-backups";
import { openServerBackup } from "@/lib/server-backups-run";

/** Read from disk this much at a time. */
const CHUNK_BYTES = 64 * 1024;

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * GET /api/backups/[name] — downloads one of the signed-in user's nightly
 * copies (see lib/server-backups.ts). Only the account's own folder is
 * looked in, and only for a name of the form myreads-backup-YYYY-MM-DD.zip:
 * anything else, another account's copy included, is a 404.
 *
 * Like the Download backup button, a download that reaches the end counts
 * as a backup made, for the Backup card's date and the monthly reminder.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { name } = await params;

  const config = serverBackupConfig();
  if (!config) return notFound();
  const file = await openServerBackup(config, userId, name);
  if (!file) return notFound();
  const { handle, bytes } = file;

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await handle.close().catch(() => {});
  };

  // Pulled, not pushed, like the export: each read from disk waits for the
  // client to ask, so the end of the file is only reached once the client
  // has read everything before it, and only then does it count.
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (cancelled) return;
        let bytesRead: number;
        const buffer = new Uint8Array(CHUNK_BYTES);
        try {
          ({ bytesRead } = await handle.read(buffer, 0, CHUNK_BYTES, null));
        } catch (err) {
          await close();
          if (!cancelled) controller.error(err);
          return;
        }
        if (bytesRead > 0) {
          if (!cancelled) controller.enqueue(buffer.subarray(0, bytesRead));
          return;
        }
        await close();
        await recordBackupDownload(userId);
        if (cancelled) return;
        try {
          controller.close();
        } catch {
          // already closed
        }
      },
      async cancel() {
        // Client went away mid-download.
        cancelled = true;
        await close();
      },
    },
    // Nothing is read ahead of the client.
    { highWaterMark: 0 },
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bytes),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
