import { NextResponse } from "next/server";
import { guardMetadataRequest } from "@/lib/api-guard";
import { getPreferences } from "@/lib/current-user";
import { CataloguesUnreachableError, searchBooks } from "@/lib/metadata";

/**
 * GET /api/metadata/search?q=<query>
 * Backs the search-as-you-type import flow. Requires a session so the
 * instance can't be used as an anonymous metadata proxy, and spends from the
 * caller's outbound-lookup budget (see lib/api-guard.ts) — one search here
 * is three requests to third-party catalogues.
 */
export async function GET(req: Request) {
  const guard = await guardMetadataRequest();
  if (!guard.ok) return guard.response;

  // Matches the client's floor (import-search.tsx). A one- or two-letter
  // query matches most of a catalogue and is never what someone meant.
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    // The reader's catalogues, in their order (Preferences).
    const results = await searchBooks(q, (await getPreferences()).catalogues);
    return NextResponse.json({ results });
  } catch (e) {
    if (!(e instanceof CataloguesUnreachableError)) throw e;
    return NextResponse.json({ results: [], error: e.message }, { status: 502 });
  }
}
