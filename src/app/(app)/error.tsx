"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated pages. Without one, a failed query
 * drops the visitor onto Next's default error screen, which looks nothing
 * like the app and offers no way back.
 *
 * The message is deliberately generic: `error.message` from a server
 * component is a digest in production, and anything more specific risks
 * printing query internals onto the page.
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
