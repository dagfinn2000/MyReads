import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildId } from "@/lib/build-id";

export const dynamic = "force-dynamic";

let files: Promise<string[]> | null = null;

/** Every script and stylesheet of this build, as the browser asks for
 *  them. Fonts and pictures are left out: a page fetches only the ones its
 *  theme uses, and the service worker keeps those as they come. */
async function buildFiles(): Promise<string[]> {
  const root = path.join(process.cwd(), ".next", "static");
  const out: string[] = [];
  async function walk(dir: string, rel: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (name !== "media") await walk(path.join(dir, entry.name), name);
      } else if (/\.(js|css)$/.test(entry.name)) {
        out.push(`/_next/static/${name}`);
      }
    }
  }
  await walk(root, "");
  return out.sort();
}

/**
 * GET /api/offline/assets — what the service worker (public/sw.js) keeps
 * when it installs, so every page saved on the device can start without a
 * connection. The list is the same for everyone and names only files any
 * page already links to, so it needs no session (src/proxy.ts).
 */
export async function GET() {
  files ??= buildFiles();
  let list: string[] = [];
  try {
    list = await files;
  } catch {
    // Read again next time.
    files = null;
  }
  return NextResponse.json({ version: buildId(), files: list }, { headers: { "Cache-Control": "no-store" } });
}
