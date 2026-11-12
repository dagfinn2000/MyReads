import fs from "node:fs";
import path from "node:path";

let id: string | undefined;

/**
 * This build's id (.next/BUILD_ID, which `next build` writes), or "" in
 * development. The service worker is registered under it
 * (components/offline-provider.tsx), so each update of the server
 * installs a fresh one that keeps the new build's files and drops the old.
 */
export function buildId(): string {
  if (process.env.NODE_ENV !== "production") return "";
  if (id === undefined) {
    try {
      id = fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    } catch {
      id = "";
    }
  }
  return id;
}
