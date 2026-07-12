import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchBooks } from "@/lib/metadata";

/**
 * GET /api/metadata/search?q=<query>
 * Backs the search-as-you-type import flow. Requires a session so the
 * instance can't be used as an anonymous metadata proxy.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchBooks(q);
  return NextResponse.json({ results });
}
