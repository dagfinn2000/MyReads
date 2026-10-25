import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildBackupZip, recordBackupDownload } from "@/lib/backup-zip";

/**
 * GET /api/export — downloads the signed-in user's entire library as a zip
 * (library.json plus the cached covers; see lib/backup-zip.ts, which also
 * makes the nightly copies on the server).
 *
 * Once the client has read the whole zip, the account's `lastBackupAt` is
 * set, so the Backup card can say when the newest copy was made. A download
 * that fails or is cancelled part-way doesn't count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { stream: zipStream, fileName } = await buildBackupZip(userId);

  // Pulled, not pushed: each chunk pauses the zip until the client reads
  // again, so nothing is generated ahead of it. That keeps memory bounded
  // on a slow connection, and it means the end of the zip is only reached
  // once the client has actually read everything before it.
  let cancelled = false;
  let ended = false;
  // The pull waiting on the next chunk, if any. The stream only pulls when
  // a read is waiting and nothing is queued.
  let waiting: (() => void) | null = null;
  const wake = () => {
    const resolve = waiting;
    waiting = null;
    resolve?.();
  };

  // The client has read the last chunk and asked for more: remember when,
  // then end the stream. The client may have gone away while the date was
  // being written, in which case the stream is already closed.
  const finish = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    await recordBackupDownload(userId);
    if (cancelled) return;
    try {
      controller.close();
    } catch {
      // already closed
    }
  };

  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        zipStream
          .on("data", (chunk: Uint8Array) => {
            zipStream.pause();
            if (cancelled) return;
            controller.enqueue(chunk);
            wake();
          })
          .on("error", (err: Error) => {
            if (cancelled) return;
            cancelled = true; // a broken zip is no backup
            controller.error(err);
            wake();
          })
          .on("end", () => {
            ended = true;
            if (cancelled || !waiting) return;
            // A read is already waiting on an empty queue, so the client
            // has had every chunk.
            const resolve = waiting;
            waiting = null;
            void finish(controller).finally(resolve);
          });
      },
      pull(controller) {
        if (cancelled) return;
        if (ended) return finish(controller);
        return new Promise<void>((resolve) => {
          waiting = resolve;
          zipStream.resume();
        });
      },
      cancel() {
        // Client went away mid-download — stop generating.
        cancelled = true;
        zipStream.pause();
        wake();
      },
    },
    // Nothing is read ahead of the client.
    { highWaterMark: 0 },
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
