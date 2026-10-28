import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { COVER_WIDTHS } from "@/lib/cover-src";
import { coverFilePath, coverThumbnail } from "@/lib/covers";
import { MIME_BY_KIND, type ImageKind } from "@/lib/image-type";

const KIND_BY_EXT: Record<string, ImageKind> = {
  ".jpg": "jpg",
  ".png": "png",
  ".gif": "gif",
  ".webp": "webp",
};

/** GET /api/covers/[filename] — serves a locally cached cover image, or with
 *  ?w=<width> (one of COVER_WIDTHS) a smaller copy of it as WebP, falling
 *  back to the cover itself if the copy can't be made. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  // basename() strips any path segments — no traversal out of the cache dir.
  const safe = path.basename(filename);
  const kind = KIND_BY_EXT[path.extname(safe).toLowerCase()];
  if (!kind) return new NextResponse("Not found", { status: 404 });

  const width = Number(new URL(req.url).searchParams.get("w"));
  const thumb = (COVER_WIDTHS as readonly number[]).includes(width)
    ? await coverThumbnail(safe, width)
    : null;

  try {
    const buf = thumb ?? (await fs.readFile(coverFilePath(safe)));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": thumb ? "image/webp" : MIME_BY_KIND[kind],
        // Filenames embed a content hash (or a random upload id), so a
        // changed cover always gets a new URL and immutable caching is safe.
        //
        // `private`, not `public`: this route sits behind the session check
        // in proxy.ts, so the response belongs to one user and must not be
        // held in a shared cache on the way out.
        "Cache-Control": "private, max-age=31536000, immutable",
        // Belt-and-braces against content sniffing: uploads are validated by
        // magic bytes, but if anything ever lands here that isn't the image
        // its extension claims, the browser must not go looking for HTML.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
