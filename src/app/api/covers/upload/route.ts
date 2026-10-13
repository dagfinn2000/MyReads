import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { auth } from "@/auth";
import { readBodyCapped } from "@/lib/capped-read";
import { coverFilePath, coversDir } from "@/lib/covers";
import { sniffImageKind } from "@/lib/image-type";
import { uploadLimiter } from "@/lib/rate-limit";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/covers/upload — saves a user-provided cover image (e.g. a photo
 * of the book you own) into the cover cache and returns its serving URL.
 * The file lands in the same COVERS_DIR volume as downloaded covers, so
 * existing deploys need no new configuration.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = `upload:${session.user.id}`;
  if (uploadLimiter.blocked(key)) {
    return NextResponse.json(
      { error: "Too many uploads — try again later" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  uploadLimiter.hit(key);

  // The image plus a little room for the multipart wrapping around it, read
  // with a ceiling rather than all of whatever was sent.
  const body = await readBodyCapped(req, MAX_BYTES + 64 * 1024);
  if (!body) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
  }
  const form = await new Response(new Uint8Array(body), {
    headers: { "Content-Type": req.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // The extension comes from the bytes, not from the client-declared MIME
  // type: `file.type` is caller-controlled, so trusting it means arbitrary
  // content can be written under an image extension and later served with an
  // image Content-Type.
  const ext = sniffImageKind(buf);
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type (use JPEG, PNG, GIF, or WebP)" },
      { status: 400 },
    );
  }

  await fs.mkdir(coversDir(), { recursive: true });
  // "upload-" prefix keeps these visually distinct from book-id covers; the
  // random name means an abandoned form never collides with anything.
  const filename = `upload-${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(coverFilePath(filename), buf);

  return NextResponse.json({ url: `/api/covers/${filename}` });
}
