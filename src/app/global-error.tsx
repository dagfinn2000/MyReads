"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches failures in the root layout itself, which the
 * per-section error.tsx cannot. It replaces the whole document, so it has to
 * render its own <html> and <body> and cannot rely on the app's stylesheet
 * being applied — hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "34rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 .5rem" }}>
            MyReads couldn&apos;t start
          </h1>
          <p style={{ color: "#666", margin: "0 0 1rem", lineHeight: 1.5 }}>
            Something failed before the page could render. If this persists,
            check the server logs — the database may be unreachable.
          </p>
          {error.digest && (
            <p style={{ color: "#888", fontSize: ".8rem", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: ".5rem 1rem",
              borderRadius: ".375rem",
              border: "1px solid #ccc",
              background: "transparent",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
