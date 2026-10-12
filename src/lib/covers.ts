import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readBodyCapped } from "@/lib/capped-read";
import { checkUrlAllowed } from "@/lib/net-guard";
import { prisma } from "@/lib/prisma";

/**
 * Local cover-image cache. When a book is saved with a remote cover URL the
 * image is downloaded here once and served from /api/covers/<file> from then
 * on, so the library never depends on (or hammers) covers.openlibrary.org.
 *
 * In Docker this directory is a named volume (COVERS_DIR=/app/data/covers).
 */
export function coversDir(): string {
  return (
    process.env.COVERS_DIR ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "covers")
  );
}

/**
 * Where the cached cover `filename` lives on disk. Every read and write in
 * the cache goes through here so the build's file tracer is told once, in
 * one place, that these paths are only known at runtime. Without the hint
 * it can't tell what they point at and copies project files into the
 * standalone bundle (and so the Docker image) to be safe.
 */
export function coverFilePath(filename: string): string {
  return path.join(/* turbopackIgnore: true */ coversDir(), filename);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Hard ceiling on a downloaded cover. Book covers are tens to hundreds of
 *  KB; anything past this is a mistake or an attempt to exhaust memory. */
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Redirect hops to follow. Open Library covers redirect to archive.org, so
 *  some redirection is required; an unbounded chain is not. */
const MAX_REDIRECTS = 3;

/**
 * Fetches `url`, following redirects one hop at a time and re-checking every
 * destination against the SSRF guard. `redirect: "follow"` would let a public
 * URL bounce the request to 169.254.169.254 or a LAN host, so each hop has to
 * be validated on its own — checking only the URL the user typed is not
 * enough.
 */
async function guardedFetch(url: string): Promise<Response | null> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const allowed = await checkUrlAllowed(target);
    if (!allowed.ok) return null;

    const res = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "myreads/1.0 (self-hosted personal library)" },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) return null;
      target = new URL(location, target).toString();
      continue;
    }
    return res;
  }
  return null; // too many redirects
}

/**
 * Downloads `remoteUrl` into the cover cache and returns the app-relative
 * URL it will be served from, or null if anything failed (bad status, not an
 * image, timeout, blocked address, oversized). Failure is non-fatal by
 * design — the caller keeps the remote URL as-is.
 *
 * The filename embeds a content hash so a changed cover gets a *new* URL —
 * required for correctness, because /api/covers serves with
 * `Cache-Control: immutable` and browsers never refetch a cached URL.
 */
export async function cacheCoverImage(
  remoteUrl: string,
  bookId: string,
): Promise<string | null> {
  try {
    const res = await guardedFetch(remoteUrl);
    if (!res || !res.ok) {
      await res?.body?.cancel().catch(() => {});
      return null;
    }

    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      await res.body?.cancel().catch(() => {});
      return null;
    }

    const buf = await readBodyCapped(res, MAX_COVER_BYTES);
    if (!buf) return null;
    // Open Library serves a tiny placeholder for missing covers; skip those.
    if (buf.length < 500) return null;

    const dir = coversDir();
    await fs.mkdir(dir, { recursive: true });
    const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
    const filename = `${bookId}-${hash}.${ext}`;
    await fs.writeFile(coverFilePath(filename), buf);
    return `/api/covers/${filename}`;
  } catch {
    return null;
  }
}

/**
 * Removes a cached cover file, if `coverUrl` points into the cache and no
 * book uses it any more. Call it after the row that held `coverUrl` has been
 * changed or deleted.
 *
 * coverUrl is only a string: the book form accepts any local path, and a
 * restored backup keeps the path it had. So two books, even two accounts'
 * books, can name the same file, and deleting it for one would break the
 * other's cover (or let one account delete another's). When in doubt the
 * file stays; `npm run covers:prune` clears what nothing points at.
 */
export async function deleteCachedCover(coverUrl: string | null | undefined) {
  if (!coverUrl?.startsWith("/api/covers/")) return;
  const filename = path.basename(coverUrl);
  try {
    const stillUsed = await prisma.book.count({
      where: { coverUrl: { contains: filename } },
    });
    if (stillUsed > 0) return;
  } catch {
    return; // can't tell — keep the file
  }
  try {
    await fs.unlink(coverFilePath(filename));
  } catch {
    // already gone — fine
  }
}

/**
 * deleteCachedCover for many books at once (bulk delete). One look at every
 * cached cover still in use, instead of a search of every book per cover,
 * which for thousands of books is thousands of full scans. The rule is the
 * same: a file any book still names stays.
 */
export async function deleteCachedCovers(coverUrls: (string | null | undefined)[]) {
  const filenames = new Set(
    coverUrls
      .filter((url): url is string => !!url?.startsWith("/api/covers/"))
      .map((url) => path.basename(url)),
  );
  if (filenames.size === 0) return;

  const stillUsed = new Set<string>();
  try {
    const rows = await prisma.book.findMany({
      where: { coverUrl: { contains: "/api/covers/" } },
      select: { coverUrl: true },
    });
    for (const { coverUrl } of rows) {
      if (!coverUrl) continue;
      stillUsed.add(path.basename(coverUrl));
      // A full address or one with a query string still names the file.
      const named = /\/api\/covers\/([^/?#]+)/.exec(coverUrl)?.[1];
      if (named) stillUsed.add(named);
    }
  } catch {
    return; // can't tell — keep them all
  }

  for (const filename of filenames) {
    if (stillUsed.has(filename)) continue;
    try {
      await fs.unlink(coverFilePath(filename));
    } catch {
      // already gone — fine
    }
  }
}
