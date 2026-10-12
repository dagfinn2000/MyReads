import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { METADATA_LOOKUPS_PER_MINUTE, metadataLimiter } from "@/lib/rate-limit";

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

  const limited = spendMetadataBudget(session.user.id);
  if (limited) return { ok: false, response: limited };

  return { ok: true, userId: session.user.id };
}

/**
 * Spends one unit of `userId`'s outbound-lookup budget. Returns a 429 to send
 * back when the budget is used up, or null when the lookup may go ahead.
 *
 * For routes that only sometimes call out (like /api/library/check, which
 * looks an ISBN up only when it isn't already in the library), so they can
 * spend the budget at the point they reach for a catalogue.
 */
export function spendMetadataBudget(userId: string): NextResponse | null {
  const key = `metadata:${userId}`;
  if (metadataLimiter.blocked(key)) {
    return NextResponse.json(
      { error: "Too many lookups — slow down a moment" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  metadataLimiter.hit(key);
  return null;
}

/**
 * Takes `units` of `userId`'s outbound-lookup budget at once, or none when
 * fewer are left. For callers that aren't routes (the shelf scan), which
 * want to know how long to wait rather than a 429. `used` is the window's
 * count after the call, to show the reader.
 */
export function takeMetadataBudget(
  userId: string,
  units = 1,
): { ok: true; used: number } | { ok: false; retryInMs: number; used: number } {
  const key = `metadata:${userId}`;
  const { count, resetInMs } = metadataLimiter.usage(key);
  if (count + units > METADATA_LOOKUPS_PER_MINUTE) {
    return { ok: false, retryInMs: resetInMs, used: count };
  }
  for (let i = 0; i < units; i++) metadataLimiter.hit(key);
  return { ok: true, used: count + units };
}

/** Lookups `userId` has made in the current minute. */
export function metadataBudgetUsed(userId: string): number {
  return metadataLimiter.usage(`metadata:${userId}`).count;
}
