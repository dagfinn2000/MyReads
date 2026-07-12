import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookDetails } from "@/lib/metadata";

/**
 * GET /api/metadata/details?olid=…&isbn=…&title=…&author=…
 * Called when the user picks a search result — fetches description/subjects
 * (and Google Books enrichment when configured) for the review form.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const details = await getBookDetails({
    openLibraryId: params.get("olid"),
    isbn: params.get("isbn"),
    title: params.get("title"),
    author: params.get("author"),
  });

  return NextResponse.json({ details });
}
