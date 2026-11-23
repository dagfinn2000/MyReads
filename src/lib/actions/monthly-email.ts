"use server";

import { headers } from "next/headers";
import { requireUserId } from "@/lib/actions/helpers";
import { mailEnabled, MailError, sendMail } from "@/lib/mail";
import { isMonthKey, lastMonth } from "@/lib/monthly-email";
import { composeMonthlyEmail } from "@/lib/monthly-email-run";
import { expectedSite } from "@/lib/passkeys";
import { parsePreferences, serverTimeZone } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";
import { RateLimiter } from "@/lib/rate-limit";

/**
 * Preferences › Monthly email's Send now: last month's email (or another
 * month's) to the reader's address straight away, to see what it looks
 * like in their own mail app. It doesn't count as the month's email.
 */

/** A few a quarter of an hour: enough to try a fix, not enough to make the
 *  server a way to fill someone's inbox. */
const sendLimiter = new RateLimiter(5, 15 * 60_000);

export async function sendMonthlyEmailNow(
  rawMonth?: unknown,
): Promise<{ sentTo: string } | { error: string }> {
  const userId = await requireUserId();
  if (!mailEnabled()) return { error: "Email isn’t set up on this server." };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, preferences: true },
  });
  if (!user) return { error: "Couldn’t find your account." };
  const prefs = parsePreferences(user.preferences);
  if (!prefs.emailAddress) return { error: "Add your email address first." };

  const now = new Date();
  const zone = prefs.timeZone || serverTimeZone();
  const latest = lastMonth(now, zone);
  const month = isMonthKey(rawMonth) && rawMonth <= latest ? rawMonth : latest;

  if (sendLimiter.blocked(userId)) {
    return { error: "That’s a few in a short while. Try again in a quarter of an hour." };
  }
  sendLimiter.hit(userId);

  // Where the reader has MyReads open now is where the email's links go,
  // when AUTH_URL doesn't say.
  const site = expectedSite(await headers())?.origin;
  if (site && site !== prefs.emailSite) {
    prefs.emailSite = site;
    await prisma.$executeRaw`
      UPDATE "User"
      SET "preferences" = COALESCE("preferences", '{}'::jsonb) || ${JSON.stringify({ emailSite: site })}::jsonb
      WHERE "id" = ${userId}`;
  }

  try {
    const email = await composeMonthlyEmail(user, prefs, month);
    await sendMail(email.message);
    return { sentTo: prefs.emailAddress };
  } catch (err) {
    if (err instanceof MailError) return { error: err.message };
    console.error("[myreads] monthly email (sent by hand) failed:", err);
    return { error: "Couldn’t put the email together. Try again in a moment." };
  }
}
