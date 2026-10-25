import { z } from "zod";
import { checkUrlAllowed } from "@/lib/net-guard";
import { prisma } from "@/lib/prisma";
import { MAX_PUSH_DEVICES, deviceLabel } from "@/lib/reminders";
import { fromBase64Url, toBase64Url } from "@/lib/web-push";

/**
 * The account's browsers that take reading reminders (PushDevice). Saved
 * from Preferences when a browser turns them on (actions/reminders.ts),
 * and by the reminders' service worker when the browser's push service
 * hands it a new address (api/push/renew).
 */

const base64Url = z.string().max(200).regex(/^[A-Za-z0-9_-]+={0,2}$/);

/** What PushSubscription.toJSON() gives, as far as sending needs it. */
const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2000)
    .refine((s) => URL.canParse(s) && new URL(s).protocol === "https:"),
  keys: z.object({ p256dh: base64Url, auth: base64Url }),
});

/**
 * Saves a browser's subscription for `userId`. One already saved (under
 * this account or another: the browser is the one signed in now) is taken
 * over with its new keys, and so is the row for `replacing`, the address
 * the browser had before, when it is this account's.
 */
export async function savePushDevice(
  userId: string,
  raw: unknown,
  userAgent: string | null,
  replacing?: string | null,
): Promise<{ error?: string }> {
  const sub = subscriptionSchema.safeParse(raw);
  const p256dh = sub.success ? fromBase64Url(sub.data.keys.p256dh) : null;
  const auth = sub.success ? fromBase64Url(sub.data.keys.auth) : null;
  if (!sub.success || p256dh?.length !== 65 || p256dh[0] !== 4 || auth?.length !== 16) {
    return { error: "This browser's subscription couldn't be read." };
  }
  const { endpoint } = sub.data;
  const allowed = await checkUrlAllowed(endpoint);
  if (!allowed.ok) return { error: "This server can't reach that browser's push service." };

  const keys = { p256dh: toBase64Url(p256dh), auth: toBase64Url(auth) };
  const label = deviceLabel(userAgent);
  if (replacing && replacing !== endpoint) {
    const renewed = await prisma.pushDevice.updateMany({
      where: { endpoint: replacing, userId },
      data: { endpoint, label, ...keys },
    });
    if (renewed.count > 0) return {};
  }
  const existing = await prisma.pushDevice.findUnique({ where: { endpoint }, select: { userId: true } });
  if (existing?.userId !== userId) {
    const count = await prisma.pushDevice.count({ where: { userId } });
    if (count >= MAX_PUSH_DEVICES) {
      return { error: `Reminders can be on for ${MAX_PUSH_DEVICES} browsers at most. Remove one first.` };
    }
  }
  await prisma.pushDevice.upsert({
    where: { endpoint },
    create: { userId, endpoint, label, ...keys },
    update: { userId, label, ...keys },
  });
  return {};
}
