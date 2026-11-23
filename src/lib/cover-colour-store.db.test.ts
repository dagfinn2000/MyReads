import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

/** Cover colours read on the server with the spines' rule, and kept. */

const { coverColours } = await import("@/lib/cover-colour-store");

let coversDir: string;
const savedCoversDir = process.env.COVERS_DIR;
const files = [`red-${Date.now()}.png`, `blue-${Date.now()}.png`, `broken-${Date.now()}.jpg`];

beforeAll(async () => {
  coversDir = await fs.mkdtemp(path.join(os.tmpdir(), "myreads-covers-"));
  process.env.COVERS_DIR = coversDir;
  const solid = (r: number, g: number, b: number) =>
    sharp({ create: { width: 60, height: 90, channels: 3, background: { r, g, b } } }).png().toBuffer();
  await fs.writeFile(path.join(coversDir, files[0]), await solid(200, 30, 30));
  await fs.writeFile(path.join(coversDir, files[1]), await solid(30, 60, 200));
  await fs.writeFile(path.join(coversDir, files[2]), "not an image");
});

afterAll(async () => {
  await prisma.coverColour.deleteMany({ where: { file: { in: files } } });
  await fs.rm(coversDir, { recursive: true, force: true });
  if (savedCoversDir === undefined) delete process.env.COVERS_DIR;
  else process.env.COVERS_DIR = savedCoversDir;
});

describe("coverColours", () => {
  it("reads each cover's main colour once and keeps it", async () => {
    const first = await coverColours(files);
    expect(first.get(files[0])).toBe("#c81e1e");
    expect(first.get(files[1])).toBe("#1e3cc8");
    expect(first.get(files[2])).toBe("");
    expect(await prisma.coverColour.count({ where: { file: { in: files } } })).toBe(3);

    // Kept: a changed file isn't read again (its name would have changed).
    await fs.writeFile(path.join(coversDir, files[0]), "gone");
    expect((await coverColours([files[0]])).get(files[0])).toBe("#c81e1e");
  });
});
