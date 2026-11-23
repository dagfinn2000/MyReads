import fs from "node:fs/promises";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { coverFilePath } from "@/lib/covers";
import { spineColour } from "@/lib/spine-colour";

/**
 * The main colour of each cached cover, for the sort by cover colour
 * (lib/rainbow.ts). Read once per file on the server, the way the spines
 * read it in the browser (lib/cover-colours.ts): the cover drawn 24 by 36
 * pixels and handed to spineColour, so the order matches the spines.
 * Kept in CoverColour by file name.
 */

/** How long a page waits for colours it hasn't read before; the rest are
 *  read after the page is sent, ready for the next visit. */
const BUDGET_MS = 1500;
const AT_ONCE = 6;

/** "#rrggbb" for a cached cover, or "" when it can't be read. */
export async function readCoverColour(file: string): Promise<string> {
  try {
    const { default: sharp } = await import("sharp");
    const { data } = await sharp(await fs.readFile(coverFilePath(file)))
      .resize(24, 36, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return spineColour(data) ?? "";
  } catch {
    return "";
  }
}

async function readAndKeep(files: string[], deadline: number): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      if (Date.now() > deadline) return;
      found.set(file, await readCoverColour(file));
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  if (found.size > 0) {
    await prisma.coverColour.createMany({
      data: [...found].map(([file, colour]) => ({ file, colour })),
      skipDuplicates: true,
    });
  }
  return found;
}

/**
 * The colours of these cached cover files, by file name. Ones not read
 * before are read now for up to a second and a half; any left after that
 * are read once the page has gone out, and are missing from this answer.
 */
export async function coverColours(files: Iterable<string>): Promise<Map<string, string>> {
  const wanted = [...new Set(files)];
  const colours = new Map<string, string>();
  if (wanted.length === 0) return colours;
  const rows = await prisma.coverColour.findMany({
    where: { file: { in: wanted } },
    select: { file: true, colour: true },
  });
  for (const r of rows) colours.set(r.file, r.colour);
  const missing = wanted.filter((f) => !colours.has(f));
  if (missing.length === 0) return colours;

  const read = await readAndKeep(missing, Date.now() + BUDGET_MS);
  for (const [file, colour] of read) colours.set(file, colour);
  const left = missing.filter((f) => !read.has(f));
  if (left.length > 0) {
    try {
      after(() => readAndKeep(left, Infinity).then(() => undefined));
    } catch {
      // Outside a request (a test, a script): they wait for the next ask.
    }
  }
  return colours;
}
