import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCoverCandidates } from "@/lib/metadata";

/**
 * GET /api/metadata/covers?isbn=…&title=…&author=…
 * Backs the cover picker in the book form — returns candidate cover images
 * from Open Library, Google Books, and the National Library of Norway.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const isbn = params.get("isbn")?.replace(/[\s-]/g, "") || null;
  const title = params.get("title")?.trim() || null;
  const author = params.get("author")?.trim() || null;

  if (!isbn && !title) {
    return NextResponse.json({ covers: [] });
  }

  const covers = await getCoverCandidates({ isbn, title, author });
  return NextResponse.json({ covers });
}
