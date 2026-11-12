"use client";

import { useEffect, useState } from "react";
import { BookOpenText, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SavedPage {
  path: string;
  title: string;
  savedAt: number;
}

/** The pages the service worker has kept (public/sw.js), Now reading
 *  first, then the newest. */
async function savedPages(): Promise<SavedPage[]> {
  if (typeof caches === "undefined") return [];
  const pages: SavedPage[] = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith("myreads-pages-")) continue;
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      const url = new URL(req.url);
      const title = decodeURIComponent(res?.headers.get("x-myreads-title") ?? "").replace(/ · MyReads$/, "");
      pages.push({
        path: url.pathname + url.search,
        title: title || url.pathname,
        savedAt: Number(res?.headers.get("x-myreads-saved")) || 0,
      });
    }
  }
  return pages.sort((a, b) => Number(b.path === "/reading") - Number(a.path === "/reading") || b.savedAt - a.savedAt);
}

function ago(ms: number, now: number): string {
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * The offline page: what's going on, the pages that do open without a
 * connection, and a way to try again. Links are plain, so the service
 * worker answers each with its saved copy.
 */
export function OfflineScreen() {
  const [pages, setPages] = useState<SavedPage[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let live = true;
    void savedPages()
      .catch(() => [])
      .then((list) => {
        if (!live) return;
        setNow(Date.now());
        setPages(list.slice(0, 12));
      });
    // Back online: the page that was asked for, for real.
    const back = () => location.reload();
    window.addEventListener("online", back);
    return () => {
      live = false;
      window.removeEventListener("online", back);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <CloudOff className="size-12 text-muted-foreground/40" aria-hidden="true" />
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
          <p className="text-sm text-muted-foreground">
            This page isn&apos;t saved on this device yet. Pages you&apos;ve opened lately open
            without a connection, and reading you log there is sent once you&apos;re back.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href="/reading">
              <BookOpenText data-slot="icon" />
              Now reading
            </a>
          </Button>
          <Button variant="outline" onClick={() => location.reload()}>
            Try again
          </Button>
        </div>
        {pages && pages.length > 0 && (
          <section className="grid w-full gap-2 text-left">
            <h2 className="text-sm font-medium text-muted-foreground">Saved on this device</h2>
            <ul className="grid divide-y rounded-lg ring-1 ring-foreground/10">
              {pages.map((p) => (
                <li key={p.path}>
                  <a
                    href={p.path}
                    className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 truncate font-medium">{p.title}</span>
                    {p.savedAt > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">{ago(p.savedAt, now)}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
