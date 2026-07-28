/**
 * Image type detection from magic bytes.
 *
 * Upload previously took the extension from `file.type`, which is whatever
 * the browser (or a hand-rolled request) put in the multipart part header —
 * so the bytes on disk need not be an image at all, and the extension chosen
 * for them need not match their content. Sniffing the actual header is both
 * stricter (non-images are rejected) and more forgiving (a real JPEG sent
 * with a wrong or missing MIME type is still stored correctly).
 */

export type ImageKind = "jpg" | "png" | "gif" | "webp";

/** Extension → the Content-Type /api/covers should serve it as. */
export const MIME_BY_KIND: Record<ImageKind, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/**
 * The image kind implied by the leading bytes, or null when the data isn't
 * one of the four formats the cover cache serves.
 */
export function sniffImageKind(buf: Uint8Array): ImageKind | null {
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";

  // GIF: "GIF87a" / "GIF89a"
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "gif";

  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }

  return null;
}
