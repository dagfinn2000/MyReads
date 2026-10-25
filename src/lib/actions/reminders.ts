"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireUserId } from "@/lib/actions/helpers";
import { getPreferences } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { savePushDevice } from "@/lib/push-devices";
import { formatClock, reminderDaysText, remindersEnabled } from "@/lib/reminders";
import { pushTo, vapidKeys } from "@/lib/reminders-run";

/**
 * Turning reading reminders on and off for a browser (Preferences ›
 * Reading reminders). The browser subscribes with its push service itself
 * (reminder-settings.tsx); these keep the account's list of them. The
 * time and days are ordinary preferences.
 */

const OFF = "Reading reminders are turned off on this server.";

/** The public key browsers subscribe with. */
export async function reminderKey(): Promise<{ key: string } | { error: string }> {
  await requireUserId();
  if (!remindersEnabled()) return { error: OFF };
  return { key: (await vapidKeys()).publicKey };
}

/** Saves the browser that just subscribed (push-devices.ts). */
export async function addPushDevice(raw: unknown): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!remindersEnabled()) return { error: OFF };
  const res = await savePushDevice(userId, raw, (await headers()).get("user-agent"));
  if (!res.error) revalidatePath("/account");
  return res;
}

const idSchema = z.string().min(1).max(100);

/** Stops reminders to one of the account's browsers. */
export async function removePushDevice(id: unknown): Promise<void> {
  const userId = await requireUserId();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return;
  await prisma.pushDevice.deleteMany({ where: { id: parsed.data, userId } });
  revalidatePath("/account");
}

/** Sends a reminder to one browser now, to see that they arrive. */
export async function sendTestReminder(id: unknown): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!remindersEnabled()) return { error: OFF };
  const parsed = idSchema.safeParse(id);
  const device =
    parsed.success &&
    (await prisma.pushDevice.findFirst({
      where: { id: parsed.data, userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }));
  if (!device) return { error: "That browser no longer takes reminders." };
  const prefs = await getPreferences();
  const outcome = await pushTo(device, {
    title: "Reading reminders are on",
    body: `${reminderDaysText(prefs.reminderDays, prefs.weekStart)} at ${formatClock(prefs.reminderTime, prefs.dateFormat)}.`,
    url: "/reading",
  }).catch(() => "failed" as const);
  if (outcome === "gone") {
    await prisma.pushDevice.deleteMany({ where: { id: device.id } });
    revalidatePath("/account");
    return { error: "That browser has stopped taking reminders, so it's off the list now." };
  }
  if (outcome === "failed") return { error: "The browser's push service didn't take it. Try again later." };
  return {};
}
