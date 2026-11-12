import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncItems } from "@/lib/reading-sync";

/**
 * POST /api/reading/sync — reading a browser saved while it was offline
 * (lib/outbox.ts), sent once it can reach the server: `{ items }`, oldest
 * first. Answers `{ results }`, one per item, in the same order
 * (lib/reading-sync.ts). A route rather than a server action, so a page
 * saved before the server was updated can still send what it holds.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // JSON only, which no other site can send here without asking first.
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const text = await req.text();
  if (text.length > 100_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }
  const out = await syncItems(session.user.id, body);
  return NextResponse.json(out, { status: "error" in out ? 400 : 200, headers: { "Cache-Control": "no-store" } });
}
