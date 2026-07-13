import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { coversDir } from "@/lib/covers";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/covers/upload — saves a user-provided cover image (e.g. a photo
 * of the book you own) into the cover cache and returns its serving URL.
 * The file lands in the same COVERS_DIR volume as downloaded covers, so
 * existing deploys need no new configuration.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type (use JPEG, PNG, GIF, or WebP)" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = coversDir();
  await fs.mkdir(dir, { recursive: true });
  // "upload-" prefix keeps these visually distinct from book-id covers; the
  // random name means an abandoned form never collides with anything.
  const filename = `upload-${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buf);

  return NextResponse.json({ url: `/api/covers/${filename}` });
}
