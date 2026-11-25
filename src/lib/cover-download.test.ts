import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { cacheCoverImage } = await import("./covers");

/**
 * Downloading a cover into the cache (cacheCoverImage): the bytes decide
 * what it is, whatever the other server's Content-Type says. The address is
 * a public literal, so the SSRF guard passes it without asking DNS.
 */

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1000, 7)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000, 7)]);
const HTML = Buffer.from(`<!DOCTYPE html><script>alert(1)</script>${" ".repeat(1000)}`);

function serve(body: Buffer, type: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array(body), { status: 200, headers: { "Content-Type": type } })),
  );
}

describe("cacheCoverImage", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "covers-"));
    process.env.COVERS_DIR = dir;
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    delete process.env.COVERS_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("keeps a real image under the kind its bytes are", async () => {
    serve(JPEG, "image/jpeg");
    const jpg = await cacheCoverImage("https://93.184.215.14/a.jpg", "book1");
    expect(jpg).toMatch(/^\/api\/covers\/book1-[0-9a-f]{8}\.jpg$/);
    expect(await fs.readFile(path.join(dir, path.basename(jpg!)))).toEqual(JPEG);

    // A PNG sent as a JPEG is still a PNG.
    serve(PNG, "image/jpeg");
    expect(await cacheCoverImage("https://93.184.215.14/b.jpg", "book2")).toMatch(/\.png$/);
  });

  it("keeps out what isn't an image, whatever it's labelled", async () => {
    serve(HTML, "image/gif");
    expect(await cacheCoverImage("https://93.184.215.14/c.gif", "book3")).toBeNull();
    serve(PNG, "text/html");
    expect(await cacheCoverImage("https://93.184.215.14/d.png", "book4")).toBeNull();
    expect((await fs.readdir(dir)).filter((f) => f.startsWith("book3") || f.startsWith("book4"))).toEqual([]);
  });
});
