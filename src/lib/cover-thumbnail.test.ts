import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { coverThumbnail } = await import("./covers");

describe("coverThumbnail", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "covers-"));
    process.env.COVERS_DIR = dir;
    const cover = (width: number) =>
      sharp({ create: { width, height: width * 1.5, channels: 3, background: "#3366aa" } }).png().toBuffer();
    await fs.writeFile(path.join(dir, "big.png"), await cover(600));
    await fs.writeFile(path.join(dir, "small.png"), await cover(120));
  });
  afterAll(async () => {
    delete process.env.COVERS_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("makes a WebP copy as wide as asked, and keeps it beside the covers", async () => {
    const buf = await coverThumbnail("big.png", 160);
    const meta = await sharp(buf!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(160);
    expect(await fs.readdir(path.join(dir, "thumbs"))).toContain("big.png.160.webp");
  });

  it("serves the kept copy the next time", async () => {
    const first = await coverThumbnail("big.png", 320);
    await fs.writeFile(path.join(dir, "big.png"), "not an image any more");
    expect(await coverThumbnail("big.png", 320)).toEqual(first);
  });

  it("never makes a cover bigger than it is", async () => {
    const meta = await sharp((await coverThumbnail("small.png", 480))!).metadata();
    expect(meta.width).toBe(120);
  });

  it("gives up on a cover it can't read, so the cover itself is served", async () => {
    expect(await coverThumbnail("missing.png", 160)).toBeNull();
    await fs.writeFile(path.join(dir, "broken.png"), "not an image");
    expect(await coverThumbnail("broken.png", 160)).toBeNull();
  });
});
