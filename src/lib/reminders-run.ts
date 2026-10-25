import { goalUnitWord, dailyGoalStatus, dailyGoalTarget } from "@/lib/daily-goal";
import { zonedDayStart } from "@/lib/dates";
import { ReadingStatus } from "@/lib/enums";
import { checkUrlAllowed } from "@/lib/net-guard";
import { parsePreferences, serverTimeZone, type Preferences } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";
import { formatDuration, pageToUnit, unitFor, type UnitBook } from "@/lib/progress-units";
import { reminderDue, reminderMessage, type ReminderMessage } from "@/lib/reminders";
import type { ServerJob } from "@/lib/server-jobs";
import {
  bookDayPageTotalsForUser,
  dayMinuteTotals,
  dayPageTotals,
  minutesByDayForUser,
} from "@/lib/stats-query";
import { generateVapidKeys, sendPush, type PushOutcome, type VapidKeys } from "@/lib/web-push";

/**
 * Reading reminders' work on the server: the key they are signed with,
 * sending one to a browser, and the job that looks every few minutes for
 * readers whose time has come. When one is due is decided in reminders.ts.
 */

const VAPID_SETTING = "vapidKeys";

function readKeys(value: string): VapidKeys | null {
  try {
    const keys = JSON.parse(value) as Partial<VapidKeys>;
    return typeof keys.publicKey === "string" && typeof keys.privateKey === "string"
      ? { publicKey: keys.publicKey, privateKey: keys.privateKey }
      : null;
  } catch {
    return null;
  }
}

/**
 * The server's key pair for reminders, made the first time one is asked
 * for. Two requests making it at once both keep whichever was stored first,
 * so every browser subscribes to the same key.
 */
export async function vapidKeys(): Promise<VapidKeys> {
  const stored = await prisma.serverSetting.findUnique({ where: { key: VAPID_SETTING } });
  const keys = stored && readKeys(stored.value);
  if (keys) return keys;
  const fresh = JSON.stringify(generateVapidKeys());
  if (stored) {
    // Unreadable (edited by hand): browsers subscribed to it can't be sent
    // to anyway, so a new one loses nothing.
    await prisma.serverSetting.update({ where: { key: VAPID_SETTING }, data: { value: fresh } });
  } else {
    await prisma.serverSetting.createMany({
      data: [{ key: VAPID_SETTING, value: fresh }],
      skipDuplicates: true,
    });
  }
  const row = await prisma.serverSetting.findUniqueOrThrow({ where: { key: VAPID_SETTING } });
  return readKeys(row.value)!;
}

/** Who to contact about this server's pushes, which every push service asks
 *  for: VAPID_SUBJECT (a mailto: or https: address), else the project. */
export function vapidSubject(): string {
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (subject && /^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)) return subject;
  return "https://github.com/dagfinn2000/MyReads";
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends `message` to one browser. An address that has come to point inside
 *  the server's own network is refused, as cover downloads are
 *  (net-guard.ts), and counts as failed rather than gone: it may be a
 *  passing DNS problem. */
export async function pushTo(device: PushTarget, message: ReminderMessage): Promise<PushOutcome> {
  const allowed = await checkUrlAllowed(device.endpoint);
  if (!allowed.ok) {
    console.warn(`[myreads] reading reminder not sent: ${allowed.reason}`);
    return "failed";
  }
  const { outcome, status } = await sendPush(device, JSON.stringify(message), {
    keys: await vapidKeys(),
    subject: vapidSubject(),
    // A reminder not yet delivered is replaced by the next one, and dropped
    // after 12 hours: a phone that was off all evening doesn't get it at 7.
    topic: "reading-reminder",
  });
  if (outcome === "failed") console.warn(`[myreads] reading reminder not sent: push service said ${status}`);
  return outcome;
}

/** Where the reader is in a book, in its own unit: "page 120 of 310",
 *  "45%", "2:10 in". Null before the first page. */
function placeText(
  book: UnitBook & { currentPage: number | null },
  prefs: Pick<Preferences, "ebookUnit" | "audiobookUnit">,
): string | null {
  if (!book.currentPage) return null;
  const info = unitFor(book, prefs);
  const value = pageToUnit(book.currentPage, info);
  if (info.unit === "percent") return `${value}%`;
  if (info.unit === "time") return `${formatDuration(value)} in`;
  return info.pageCount ? `page ${value} of ${info.pageCount}` : `page ${value}`;
}

/** The reminder for one reader today: the book they read last of those
 *  they are reading, and what is left of the daily goal. */
export async function buildReminder(
  userId: string,
  prefs: Preferences,
  day: string,
  timeZone: string,
): Promise<ReminderMessage> {
  const bookSelect = {
    title: true,
    format: true,
    pageCount: true,
    lengthMinutes: true,
    currentPage: true,
  } as const;
  const reading = { userId, status: ReadingStatus.READING };
  const lastLogged = await prisma.progressEntry.findFirst({
    where: { book: reading },
    orderBy: [{ date: "desc" }, { page: "desc" }],
    select: { book: { select: bookSelect } },
  });
  const book =
    lastLogged?.book ??
    (await prisma.book.findFirst({ where: reading, orderBy: { updatedAt: "desc" }, select: bookSelect }));

  let goalLeft: string | null = null;
  const goal = dailyGoalTarget(prefs);
  if (goal) {
    const byDay =
      goal.unit === "pages"
        ? dayPageTotals(await bookDayPageTotalsForUser(userId, timeZone))
        : dayMinuteTotals(await minutesByDayForUser(userId, timeZone));
    const { left } = dailyGoalStatus(byDay, goal, day);
    if (left > 0) goalLeft = `${left} ${goalUnitWord(goal.unit, left)}`;
  }

  return reminderMessage({
    book: book && { title: book.title, place: placeText(book, prefs) },
    goalLeft,
  });
}

/** Whether the reader has logged any reading on `day` so far. */
async function readOn(userId: string, day: string, timeZone: string, now: Date): Promise<boolean> {
  const entry = await prisma.progressEntry.findFirst({
    where: { book: { userId }, date: { gte: zonedDayStart(day, timeZone), lte: now } },
    select: { id: true },
  });
  return entry !== null;
}

type Send = (device: PushTarget, message: ReminderMessage) => Promise<PushOutcome>;

/**
 * One look: every account with a browser to remind whose time has come
 * gets its reminder on each of them. The day is claimed before anything is
 * sent, so a second server process, or a run that overlaps the next, can't
 * send it again; a day let go because the reader had read is claimed too.
 * Browsers whose push service says they are gone are forgotten. `send` is
 * for the tests.
 */
export async function sendDueReminders(now: Date, send: Send = pushTo): Promise<{ sent: number }> {
  const users = await prisma.user.findMany({
    where: { pushDevices: { some: {} } },
    select: { id: true, preferences: true, lastReminderDay: true },
  });
  let sent = 0;
  for (const user of users) {
    try {
      const prefs = parsePreferences(user.preferences);
      const zone = prefs.timeZone || serverTimeZone();
      const day = reminderDue(
        { time: prefs.reminderTime, days: prefs.reminderDays },
        user.lastReminderDay,
        now,
        zone,
      );
      if (!day) continue;
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ lastReminderDay: null }, { lastReminderDay: { not: day } }] },
        data: { lastReminderDay: day },
      });
      if (claimed.count === 0) continue;
      if (prefs.reminderSkipIfRead && (await readOn(user.id, day, zone, now))) continue;

      const message = await buildReminder(user.id, prefs, day, zone);
      const devices = await prisma.pushDevice.findMany({
        where: { userId: user.id },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      for (const device of devices) {
        const outcome = await send(device, message).catch((err: unknown) => {
          console.warn("[myreads] reading reminder not sent:", err);
          return "failed" as const;
        });
        if (outcome === "sent") sent++;
        if (outcome === "gone") await prisma.pushDevice.deleteMany({ where: { id: device.id } });
      }
    } catch (err) {
      // One account's trouble mustn't keep the rest from their reminders.
      console.error("[myreads] reading reminder failed:", err);
    }
  }
  return { sent };
}

/** The job on the server's timer (server-jobs.ts). Every 5 minutes, so a
 *  reminder comes within a few minutes of its time. */
export function readingReminderJob(): ServerJob {
  return {
    name: "reading reminders",
    everyMinutes: 5,
    run: async (now) => {
      await sendDueReminders(now);
    },
  };
}
