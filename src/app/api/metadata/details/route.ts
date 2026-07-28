import { NextResponse } from "next/server";
import { guardMetadataRequest } from "@/lib/api-guard";
import { getBookDetails } from "@/lib/metadata";

/**
 * GET /api/metadata/details?olid=…&isbn=…&title=…&author=…
 * Called when the user picks a search result — fetches description/subjects
 * (and Google Books enrichment when configured) for the review form.
 */
export async function GET(req: Request) {
  const guard = await guardMetadataRequest();
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const details = await getBookDetails({
    openLibraryId: params.get("olid"),
    isbn: params.get("isbn"),
    title: params.get("title"),
    author: params.get("author"),
  });

  return NextResponse.json({ details });
}
