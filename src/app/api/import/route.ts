import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { importLibrary } from "@/lib/import";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * POST /api/import — restores a MyReads JSON export into the signed-in
 * user's library. Merge semantics with duplicate skipping; see lib/import.ts.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const length = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Not a valid JSON file" }, { status: 400 });
  }

  const result = await importLibrary(session.user.id, payload);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
