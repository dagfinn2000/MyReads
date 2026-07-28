import { describe, expect, it } from "vitest";
import { sniffImageKind } from "@/lib/image-type";

/** Builds a buffer from leading bytes plus filler, like a real file header. */
function header(bytes: number[], length = 64): Uint8Array {
  const buf = new Uint8Array(length);
  buf.set(bytes, 0);
  return buf;
}

describe("sniffImageKind", () => {
  it("detects JPEG", () => {
    expect(sniffImageKind(header([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImageKind(header([0xff, 0xd8, 0xff, 0xdb]))).toBe("jpg");
  });

  it("detects PNG", () => {
    expect(
      sniffImageKind(header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
  });

  it("detects GIF87a and GIF89a", () => {
    expect(sniffImageKind(header([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe("gif");
    expect(sniffImageKind(header([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe("gif");
  });

  it("detects WebP (RIFF container with a WEBP fourcc at offset 8)", () => {
    const buf = header([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    buf.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageKind(buf)).toBe("webp");
  });

  it("rejects a RIFF container that is not WebP (e.g. a WAV)", () => {
    const buf = header([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    buf.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(sniffImageKind(buf)).toBeNull();
  });

  it("rejects HTML masquerading as an image", () => {
    // The case the old `file.type` check let through: declare image/jpeg,
    // send markup. Stored as .jpg and served as image/jpeg, it needed only a
    // sniffing browser to become a same-origin HTML document.
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(sniffImageKind(html)).toBeNull();
  });

  it("rejects an SVG (not one of the served formats)", () => {
    expect(sniffImageKind(new TextEncoder().encode("<svg xmlns='...'>"))).toBeNull();
  });

  it("rejects empty and truncated input", () => {
    expect(sniffImageKind(new Uint8Array(0))).toBeNull();
    expect(sniffImageKind(new Uint8Array([0xff, 0xd8]))).toBeNull(); // 2 of 3 JPEG bytes
    expect(sniffImageKind(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull(); // RIFF, no fourcc
  });
});
