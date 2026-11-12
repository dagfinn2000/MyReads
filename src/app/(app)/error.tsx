"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { CloudOff, TriangleAlert } from "lucide-react";
import { isConnectionError } from "@/lib/outbox";
import { Button } from "@/components/ui/button";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Error boundary for the authenticated pages. Without one, a failed query
 * drops the visitor onto Next's default error screen, which looks nothing
 * like the app and offers no way back.
 *
 * The message is deliberately generic: `error.message` from a server
 * component is a digest in production, and anything more specific risks
 * printing query internals onto the page.
 *
 * Without a connection, most saving fails the same way (a fetch that never
 * got an answer), and then it says so: only logging reading works offline.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in `docker compose logs` next to the server-side stack trace,
    // so the digest below can be matched to the real error.
    console.error("Page error:", error);
  }, [error]);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  // A page from before a server update finds its actions gone: that's no
  // lost connection, so it gets the usual message (and Try again).
  if (!online || (isConnectionError(error) && !/Server Action unavailable/i.test(error.message))) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <CloudOff className="size-10 text-muted-foreground/40" />
        <div className="grid gap-1">
          <p className="font-medium">{online ? "MyReads can't be reached." : "You're offline."}</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            That needs a connection, so nothing was saved. Pages you log
            reading on (Now reading, a book&apos;s page) still work: what you
            log is kept on this device and sent once you&apos;re back.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            {/* A full load, which the saved copy answers. */}
            <a href="/reading">Now reading</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <TriangleAlert className="size-10 text-muted-foreground/40" />
      <div className="grid gap-1">
        <p className="font-medium">Something went wrong.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          The page couldn&apos;t be loaded. Your library is fine — this was a
          problem rendering the page, not reading your data.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/books">Back to library</Link>
        </Button>
      </div>
    </div>
  );
}
