import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { calendarDay, zonedDayStart } from "@/lib/dates";
import { ReadingStatus } from "@/lib/enums";
import { goalReadingDays } from "@/lib/goal-progress";
import { coverFilePath } from "@/lib/covers";
import { sendMail, type InlineImage, type MailMessage, type SendMail } from "@/lib/mail";
import { FINISHES_SHOWN, renderMonthlyEmail, type RenderedEmail } from "@/lib/monthly-email-html";
import {
  monthlyEmailDue,
  monthWindow,
  nextMonth,
  quietMonth,
  summarizeMonth,
  type EmailBook,
  type MonthKey,
  type MonthSummary,
} from "@/lib/monthly-email";
import { parsePreferences, serverTimeZone, type Preferences } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";
import type { ServerJob } from "@/lib/server-jobs";
import { buildPasses } from "@/lib/stats-count";
import { dayMinuteTotals, loadStatsInputs, minutesByDayForUser } from "@/lib/stats-query";

/**
 * The monthly email's work on the server: gathering a reader's month,
 * drawing it with their covers inside, sending it, and the job that looks
 * every 15 minutes for readers whose 1st has come. When one is due and
 * what it says are decided in monthly-email.ts.
 */

/** A reader's month, counted as Stats counts it. */
export async function buildMonthSummary(
  userId: string,
  username: string,
  prefs: Preferences,
  month: MonthKey,
): Promise<MonthSummary> {
  const zone = prefs.timeZone || serverTimeZone();
  const window = monthWindow(month);
  const year = Number(month.slice(0, 4));
  const from = zonedDayStart(window.from, zone);
  const until = zonedDayStart(`${nextMonth(month)}-01`, zone);

  const [inputs, dayMinutes, goals, reading, quotes] = await Promise.all([
    loadStatsInputs(userId, zone),
    minutesByDayForUser(userId, zone),
    prisma.readingGoal.findMany({
      where: { userId, year },
      select: { span: true, target: true, unit: true, countRereads: true },
    }),
    prisma.book.findMany({
      where: { userId, status: ReadingStatus.READING },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        format: true,
        pageCount: true,
        lengthMinutes: true,
        currentPage: true,
        updatedAt: true,
        progress: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
      },
    }),
    prisma.quote.findMany({
      where: { book: { userId }, createdAt: { gte: from, lt: until } },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { text: true, book: { select: { id: true, title: true, authors: true, coverUrl: true } } },
    }),
  ]);

  const inMonth = (d: Date | null) => {
    if (!d) return false;
    const day = calendarDay(d, zone);
    return day >= window.from && day <= window.to;
  };
  const audiobookIds = new Set(inputs.books.filter((b) => b.format === "AUDIOBOOK").map((b) => b.id));
  // The book read most lately first, then the one touched most lately.
  const lastRead = (b: (typeof reading)[number]) => (b.progress[0]?.date ?? b.updatedAt).getTime();
  reading.sort((a, b) => lastRead(b) - lastRead(a));

  return summarizeMonth({
    month,
    name: prefs.bookplateName || username,
    prefs,
    passes: buildPasses(inputs, prefs, zone),
    logDays: inputs.logDays,
    minutesByDay: dayMinuteTotals(dayMinutes, prefs.statsAudiobooks === "out"),
    readingDays: goalReadingDays(inputs.logDays, dayMinutes, audiobookIds, prefs),
    goals: goals.map((g) => ({ ...g, span: g.span === "MONTH" ? "MONTH" : "YEAR" })),
    reading,
    quotes,
    started: inputs.books.filter((b) => inMonth(b.dateStarted)).length,
    added: inputs.books.filter((b) => inMonth(b.createdAt)).length,
  });
}

/** The size covers are sent at: twice the largest the email shows them. */
const COVER_WIDTH = 208;
const COVER_HEIGHT = 312;

/** The books whose covers the email shows. */
function shownBooks(s: MonthSummary): EmailBook[] {
  const finished = s.favourite
    ? [s.favourite, ...s.finishes.filter((f) => f !== s.favourite).slice(0, FINISHES_SHOWN)]
    : s.finishes.slice(0, FINISHES_SHOWN);
  const seen = new Set<string>();
  return [...finished, ...s.reading.map((r) => r.book)].filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

/**
 * The covers of the books the email shows, as small JPEGs (which every
 * mail app can show, unlike WebP), cut to the 2:3 the email draws them in.
 * Only covers cached on this server: a remote one would mean fetching it,
 * and the email draws a cloth cover for it instead.
 */
async function coverPictures(books: EmailBook[]): Promise<Map<string, InlineImage>> {
  const out = new Map<string, InlineImage>();
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return out;
  }
  for (const book of books) {
    const url = book.coverUrl;
    if (!url?.startsWith("/api/covers/")) continue;
    const file = path.basename(url.split("?")[0]);
    try {
      const content = await sharp(await fs.readFile(coverFilePath(file)))
        .resize({ width: COVER_WIDTH, height: COVER_HEIGHT, fit: "cover" })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      out.set(book.id, {
        cid: `cover-${book.id}@myreads`,
        filename: `cover-${book.id}.jpg`,
        content,
        contentType: "image/jpeg",
      });
    } catch {
      // Unreadable: drawn as cloth instead.
    }
  }
  return out;
}

/** Where MyReads is, for the email's links: AUTH_URL when it's set, else
 *  where the reader had it open when they set the email up. */
export function emailSite(prefs: Pick<Preferences, "emailSite">): string | null {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }
  return prefs.emailSite || null;
}

/** The key that lets "Stop these emails" work without signing in: tied to
 *  the account and the address, so it stops working when either changes. */
export function unsubscribeToken(userId: string, address: string): string {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`monthly-email:${userId}:${address.toLowerCase()}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Whether `token` is the right key for this account and address. */
export function unsubscribeTokenOk(userId: string, address: string, token: string): boolean {
  const want = Buffer.from(unsubscribeToken(userId, address));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export interface ComposedEmail {
  summary: MonthSummary;
  rendered: RenderedEmail;
  message: MailMessage;
}

/**
 * One reader's email for `month`, ready to send. With `inlineAsData`
 * (the preview) the covers sit in the HTML itself rather than beside it.
 */
export async function composeMonthlyEmail(
  user: { id: string; username: string },
  prefs: Preferences,
  month: MonthKey,
  { inlineAsData = false }: { inlineAsData?: boolean } = {},
): Promise<ComposedEmail> {
  const summary = await buildMonthSummary(user.id, user.username, prefs, month);
  const pictures = await coverPictures(shownBooks(summary));
  const site = emailSite(prefs);
  const unsubscribe =
    site && prefs.emailAddress
      ? `${site}/api/email/unsubscribe?u=${encodeURIComponent(user.id)}&t=${unsubscribeToken(user.id, prefs.emailAddress)}`
      : null;
  const rendered = renderMonthlyEmail(
    summary,
    {
      dateFormat: prefs.dateFormat,
      numberFormat: prefs.numberFormat,
      ratingStyle: prefs.ratingStyle,
      weekStart: prefs.weekStart,
    },
    { site, unsubscribe },
    (book) => {
      const pic = pictures.get(book.id);
      if (!pic) return null;
      return inlineAsData ? `data:${pic.contentType};base64,${pic.content.toString("base64")}` : `cid:${pic.cid}`;
    },
  );
  const headers: Record<string, string> = {
    // Out-of-office replies have nowhere useful to go.
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };
  if (unsubscribe) {
    // The mail app's own Unsubscribe button (RFC 2369, one click: RFC 8058).
    headers["List-Unsubscribe"] = `<${unsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return {
    summary,
    rendered,
    message: {
      to: prefs.emailAddress,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      inline: [...pictures.values()],
      headers,
    },
  };
}

/** After a failed send, how long until that reader's is tried again; it
 *  doubles with each failure, up to six hours. Kept in memory: a restart
 *  simply tries again. */
const retryAt = new Map<string, { at: number; wait: number }>();
const FIRST_WAIT = 15 * 60_000;
const LONGEST_WAIT = 6 * 60 * 60_000;

/**
 * One look: every reader with the email on whose 1st has come gets last
 * month's. The month is claimed before it's sent, so a second server
 * process, or a run that overlaps the next, can't send it again; a month
 * let go because nothing was read in it is claimed too. A send that fails
 * gives the month back, to be tried again later in the week. `send` is for
 * the tests.
 */
export async function sendDueMonthlyEmails(now: Date, send: SendMail = sendMail): Promise<{ sent: number }> {
  const users = await prisma.user.findMany({
    where: { preferences: { path: ["monthlyEmail"], equals: true } },
    select: { id: true, username: true, preferences: true, lastMonthlyEmail: true },
  });
  let sent = 0;
  for (const user of users) {
    const retry = retryAt.get(user.id);
    if (retry && retry.at > now.getTime()) continue;
    const prefs = parsePreferences(user.preferences);
    if (!prefs.monthlyEmail || !prefs.emailAddress) continue;
    const month = monthlyEmailDue(user.lastMonthlyEmail, now, prefs.timeZone || serverTimeZone());
    if (!month) continue;
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ lastMonthlyEmail: null }, { lastMonthlyEmail: { lt: month } }] },
      data: { lastMonthlyEmail: month },
    });
    if (claimed.count === 0) continue;
    try {
      const email = await composeMonthlyEmail(user, prefs, month);
      if (prefs.monthlyEmailSkipQuiet && quietMonth(email.summary)) continue;
      await send(email.message);
      sent++;
      retryAt.delete(user.id);
    } catch (err) {
      // Give the month back, unless something else has moved it on.
      await prisma.user
        .updateMany({
          where: { id: user.id, lastMonthlyEmail: month },
          data: { lastMonthlyEmail: user.lastMonthlyEmail },
        })
        .catch(() => {});
      const wait = Math.min((retry?.wait ?? FIRST_WAIT / 2) * 2, LONGEST_WAIT);
      retryAt.set(user.id, { at: now.getTime() + wait, wait });
      console.error("[myreads] monthly email failed:", err instanceof Error ? err.message : err);
    }
  }
  return { sent };
}

/** Forgets every reader's wait after a failure. For the tests. */
export function resetMonthlyEmailRetries(): void {
  retryAt.clear();
}

/** The job on the server's timer (server-jobs.ts). */
export function monthlyEmailJob(): ServerJob {
  return {
    name: "monthly email",
    everyMinutes: 15,
    run: async (now) => {
      await sendDueMonthlyEmails(now);
    },
  };
}

