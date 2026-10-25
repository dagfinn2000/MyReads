import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { savePushDevice } from "@/lib/push-devices";
import { remindersEnabled } from "@/lib/reminders";

/**
 * POST /api/push/renew — from the reminders' service worker (push-sw.js)
 * when the browser's push service moves its subscription to a new address,
 * so reminders keep coming without a visit to Preferences. The body is
 * `{ oldEndpoint, subscription }`; the row for the old address is moved to
 * the new one.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!remindersEnabled()) return NextResponse.json({ error: "Reminders are off" }, { status: 404 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const text = await req.text();
  if (text.length > 10_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { oldEndpoint?: unknown; subscription?: unknown };
  try {
    body = JSON.parse(text) ?? {};
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }
  const old = typeof body.oldEndpoint === "string" ? body.oldEndpoint : null;
  const res = await savePushDevice(session.user.id, body.subscription, req.headers.get("user-agent"), old);
  return res.error
    ? NextResponse.json({ error: res.error }, { status: 400 })
    : NextResponse.json({ ok: true });
}
