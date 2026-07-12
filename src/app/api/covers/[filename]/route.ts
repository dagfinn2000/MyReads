import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { coversDir } from "@/lib/covers";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** GET /api/covers/[filename] — serves a locally cached cover image. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  // basename() strips any path segments — no traversal out of the cache dir.
  const safe = path.basename(filename);
  const mime = MIME_BY_EXT[path.extname(safe).toLowerCase()];
  if (!mime) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await fs.readFile(path.join(coversDir(), safe));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        // Filenames are content-addressed by book id and rewritten on change,
        // so aggressive caching is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
