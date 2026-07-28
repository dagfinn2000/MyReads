import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { metadataLimiter } from "@/lib/rate-limit";

/**
 * Shared gate for the three /api/metadata routes: requires a session, then
 * spends one unit of that user's outbound-lookup budget.
 *
 * The session check alone stops the instance being an open metadata proxy,
 * but not a signed-in client from fanning out to three external catalogues on
 * every keystroke-pause. The budget is per user, so one busy tab can't spend
 * another account's.
 *
 * Returns a Response to send back, or the user id when the call may proceed.
 */
export async function guardMetadataRequest(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const key = `metadata:${session.user.id}`;
  if (metadataLimiter.blocked(key)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many lookups — slow down a moment" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  }
  metadataLimiter.hit(key);

  return { ok: true, userId: session.user.id };
}
