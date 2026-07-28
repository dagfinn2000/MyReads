import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { checkUrlAllowed } from "@/lib/net-guard";

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

/** Hard ceiling on a downloaded cover. Book covers are tens to hundreds of
 *  KB; anything past this is a mistake or an attempt to exhaust memory. */
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Redirect hops to follow. Open Library covers redirect to archive.org, so
 *  some redirection is required; an unbounded chain is not. */
const MAX_REDIRECTS = 3;

/**
 * Reads at most `limit` bytes from the response, aborting as soon as that is
 * exceeded. `res.arrayBuffer()` would buffer whatever the server chooses to
 * send — including a deliberately endless body.
 */
async function readCapped(res: Response, limit: number): Promise<Buffer | null> {
  if (!res.body) return null;

  // Trust Content-Length when it's present and already too big: no point
  // streaming megabytes to discover what the header said up front.
  const declared = Number.parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > limit) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, total);
}

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

    const buf = await readCapped(res, MAX_COVER_BYTES);
    if (!buf) return null;
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
