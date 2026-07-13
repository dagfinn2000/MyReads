import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Local cover-image cache. When a book is saved with a remote cover URL the
 * image is downloaded here once and served from /api/covers/<file> from then
 * on, so the library never depends on (or hammers) covers.openlibrary.org.
 *
 * In Docker this directory is a named volume (COVERS_DIR=/app/data/covers).
 */
export function coversDir(): string {
  return process.env.COVERS_DIR || path.join(process.cwd(), "data", "covers");
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Downloads `remoteUrl` into the cover cache and returns the app-relative
 * URL it will be served from, or null if anything failed (bad status, not an
 * image, timeout). Failure is non-fatal by design — the caller keeps the
 * remote URL as-is.
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
    const res = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "myreads/1.0 (self-hosted personal library)" },
    });
    if (!res.ok) return null;

    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT_BY_MIME[mime];
    if (!ext) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    // Open Library serves a tiny placeholder for missing covers; skip those.
    if (buf.length < 500) return null;

    const dir = coversDir();
    await fs.mkdir(dir, { recursive: true });
    const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
    const filename = `${bookId}-${hash}.${ext}`;
    await fs.writeFile(path.join(dir, filename), buf);
    return `/api/covers/${filename}`;
  } catch {
    return null;
  }
}

/** Removes a book's cached cover file, if `coverUrl` points into the cache. */
export async function deleteCachedCover(coverUrl: string | null | undefined) {
  if (!coverUrl?.startsWith("/api/covers/")) return;
  const filename = path.basename(coverUrl);
  try {
    await fs.unlink(path.join(coversDir(), filename));
  } catch {
    // already gone — fine
  }
}
