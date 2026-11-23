import { formatDayMonth, formatNumber } from "@/lib/display";
import { GoalUnit } from "@/lib/enums";
import { formatLength } from "@/lib/progress-units";
import type { DateFormat, NumberFormat, RatingStyle, WeekStart } from "@/lib/preferences";
import {
  goalAmount,
  monthName,
  monthTitle,
  previousMonth,
  quietMonth,
  type EmailBook,
  type MonthFinish,
  type MonthSummary,
} from "@/lib/monthly-email";

/**
 * The monthly email drawn as HTML that mail apps show the same way: tables
 * for layout, every style inline, a light paper look by default and a dark
 * one for the apps that ask for it (Apple Mail, Outlook). Covers come as
 * pictures inside the message (`cid:`), since the server's own cover
 * addresses need a signed-in browser. Pure: the preview page and the tests
 * draw it too.
 */

export interface EmailLook {
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  ratingStyle: RatingStyle;
  weekStart: WeekStart;
}

export interface EmailLinks {
  /** Where MyReads is, "https://books.example.com"; null when not known,
   *  and the email then has no links. */
  site: string | null;
  /** The address that stops the email without signing in. */
  unsubscribe: string | null;
}

export interface RenderedEmail {
  subject: string;
  /** The line mail apps show after the subject. */
  preheader: string;
  html: string;
  text: string;
}

/** The pictures' colours and the paper's, light and dark. */
const LIGHT = {
  page: "#f2ece2",
  card: "#fffdf8",
  border: "#e6ddcf",
  ink: "#2b2420",
  body: "#4a4039",
  muted: "#7a6d62",
  rule: "#ebe3d7",
  accent: "#8f3d2b",
  gold: "#b07d26",
  heat: ["#f1eadf", "#ecd6b2", "#ddb47c", "#c8864a", "#9b532a"],
  heatText: ["#a99a8b", "#6d5435", "#5a3c1c", "#ffffff", "#ffffff"],
};
const DARK = {
  page: "#16120f",
  card: "#221d19",
  border: "#3a322b",
  ink: "#f3ebe0",
  body: "#d8ccbd",
  muted: "#a6988a",
  rule: "#352d27",
  accent: "#e39478",
  gold: "#e3b45a",
  heat: ["#2b2420", "#4d3722", "#7a522b", "#ad6f38", "#e1a058"],
  heatText: ["#7d6f62", "#d8c3a5", "#f3e2c8", "#ffffff", "#1b140e"],
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Cloth colours for a book without a cover, picked by its title. */
const CLOTH = ["#6b3a2e", "#2f4a5e", "#3f5a3c", "#7a5a24", "#4b3b5c", "#5a5148", "#7c3b48"];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** "★★★★½", "★★★★", "8/10", or "" with ratings off. `value` is 1–10. */
export function ratingText(value: number | null, style: RatingStyle): string {
  if (value == null || style === "off") return "";
  if (style === "ten") return `${value}/10`;
  if (style === "whole") return "★".repeat(Math.max(1, Math.round(value / 2)));
  return `${"★".repeat(Math.floor(value / 2))}${value % 2 ? "½" : ""}`;
}

function authorsText(authors: string[]): string {
  if (authors.length <= 2) return authors.join(" & ");
  return `${authors[0]} & others`;
}

/** Hours (or minutes, under an hour) as the big number and its label. */
function timeFigure(minutes: number, fmt: (n: number) => string): { value: string; label: string } {
  if (minutes < 60) return { value: fmt(minutes), label: minutes === 1 ? "Minute read" : "Minutes read" };
  const hours = minutes / 60;
  const value = hours < 10 ? (Math.round(hours * 10) / 10).toFixed(1) : fmt(Math.round(hours));
  return { value: value.replace(".0", ""), label: "Hours read" };
}

/** "Up 2 on September", "Down 1 h 20 min on September", "Same as
 *  September"; empty when neither month had any. */
function versus(now: number, then: number, prev: string, amount: (n: number) => string): string {
  if (now === 0 && then === 0) return "";
  if (now === then) return `Same as ${prev}`;
  return `${now > then ? "Up" : "Down"} ${amount(Math.abs(now - then))} on ${prev}`;
}

/** Everything one email needs to draw itself. */
interface Ctx {
  s: MonthSummary;
  look: EmailLook;
  links: EmailLinks;
  cover: (book: EmailBook) => string | null;
  fmt: (n: number) => string;
  day: (key: string) => string;
}

function coverCell(c: Ctx, book: EmailBook, width: number, cls = "cover"): string {
  const height = Math.round(width * 1.5);
  const src = c.cover(book);
  if (src) {
    return `<img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="" class="${cls}" style="display:block;width:${width}px;height:${height}px;border-radius:3px;border:0;outline:none;box-shadow:0 1px 3px rgba(43,36,32,0.25);">`;
  }
  // No picture: a cloth binding with the title's first letter.
  const cloth = CLOTH[hash(book.title) % CLOTH.length];
  const letter = escapeHtml((book.title.trim()[0] ?? "?").toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" style="width:${width}px;"><tr><td width="${width}" height="${height}" align="center" valign="middle" bgcolor="${cloth}" style="width:${width}px;height:${height}px;border-radius:3px;background-color:${cloth};color:#f6efe3;font-family:${SERIF};font-style:italic;font-size:${Math.round(width / 2.4)}px;line-height:1;">${letter}</td></tr></table>`;
}

function sectionTitle(text: string): string {
  return `<p class="muted" style="margin:0 0 14px;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;color:${LIGHT.muted};">${escapeHtml(text)}</p>`;
}

/** A section of the card, with a hairline above it. */
function section(inner: string, first = false): string {
  const rule = first ? "" : `<div class="rule" style="height:1px;line-height:1px;font-size:1px;background-color:${LIGHT.rule};margin:0 0 26px;">&nbsp;</div>`;
  return `<tr><td class="px" style="padding:${first ? "0" : "30px"} 40px 0;">${rule}${inner}</td></tr>`;
}

function statCell(value: string, label: string, note: string): string {
  return `<td class="stat" width="50%" valign="top" style="width:50%;padding:0 0 22px;">
<p class="ink" style="margin:0;font-family:${SERIF};font-size:40px;line-height:44px;color:${LIGHT.ink};">${escapeHtml(value)}</p>
<p class="muted" style="margin:4px 0 0;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:${LIGHT.muted};">${escapeHtml(label)}</p>
${note ? `<p class="muted" style="margin:3px 0 0;font-family:${SANS};font-size:12px;line-height:17px;color:${LIGHT.muted};">${escapeHtml(note)}</p>` : ""}
</td>`;
}

function statsBlock(c: Ctx): string {
  const { s, fmt } = c;
  const prev = monthName(previousMonth(s.month));
  const days = s.calendar.length;
  const cells = [
    statCell(fmt(s.books), s.books === 1 ? "Book finished" : "Books finished", versus(s.books, s.before.books, prev, fmt)),
    statCell(fmt(s.pages), s.pages === 1 ? "Page read" : "Pages read", versus(s.pages, s.before.pages, prev, fmt)),
    statCell(
      fmt(s.readingDays),
      s.readingDays === 1 ? "Reading day" : "Reading days",
      `of ${fmt(days)}${s.longestRun > 1 ? ` · ${fmt(s.longestRun)} in a row at best` : ""}`,
    ),
  ];
  if (s.minutes > 0 || s.before.minutes > 0) {
    const t = timeFigure(s.minutes, fmt);
    cells.push(statCell(t.value, t.label, versus(s.minutes, s.before.minutes, prev, formatLength)));
  } else {
    cells.push(statCell(fmt(s.longestRun), "Days in a row", "your longest run"));
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${cells[0]}${cells[1]}</tr>
<tr>${cells[2]}${cells[3]}</tr>
</table>`;
}

function finishMeta(c: Ctx, f: MonthFinish): string {
  const bits = [`Finished ${c.day(f.day)}`];
  if (f.days) bits.push(f.days === 1 ? "in a day" : `in ${c.fmt(f.days)} days`);
  if (f.pageCount) bits.push(`${c.fmt(f.pageCount)} pages`);
  return escapeHtml(bits.join(" · "));
}

function stars(c: Ctx, value: number | null, size: number): string {
  const text = ratingText(value, c.look.ratingStyle);
  if (!text) return "";
  return `<span class="gold" style="color:${LIGHT.gold};font-size:${size}px;letter-spacing:0.08em;">${escapeHtml(text)}</span>`;
}

function rereadTag(f: MonthFinish): string {
  return f.isReread
    ? ` <span class="tag" style="display:inline-block;padding:1px 7px;border:1px solid ${LIGHT.border};border-radius:999px;font-family:${SANS};font-size:11px;line-height:16px;color:${LIGHT.muted};vertical-align:2px;">Re-read</span>`
    : "";
}

function favouriteBlock(c: Ctx, f: MonthFinish): string {
  return `${sectionTitle("Book of the month")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="124" valign="top" style="width:124px;padding:0 20px 0 0;">${coverCell(c, f, 104)}</td>
<td valign="middle">
<p class="ink" style="margin:0;font-family:${SERIF};font-size:24px;line-height:30px;color:${LIGHT.ink};">${escapeHtml(f.title)}${rereadTag(f)}</p>
${f.authors.length ? `<p class="body" style="margin:4px 0 0;font-family:${SERIF};font-style:italic;font-size:16px;line-height:22px;color:${LIGHT.body};">${escapeHtml(authorsText(f.authors))}</p>` : ""}
<p style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:20px;">${stars(c, f.rating, 18)}</p>
<p class="muted" style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">${finishMeta(c, f)}</p>
</td>
</tr>
</table>`;
}

/** How many finished books the list shows before "and so many more". */
export const FINISHES_SHOWN = 10;

function finishList(c: Ctx, list: MonthFinish[], title: string): string {
  const shown = list.slice(0, FINISHES_SHOWN);
  const rows = shown
    .map(
      (f, i) => `<tr>
<td width="64" valign="top" style="width:64px;padding:${i ? 16 : 0}px 16px 0 0;">${coverCell(c, f, 48)}</td>
<td valign="top" style="padding:${i ? 16 : 0}px 0 0;">
<p class="ink" style="margin:0;font-family:${SERIF};font-size:17px;line-height:23px;color:${LIGHT.ink};">${escapeHtml(f.title)}${rereadTag(f)}</p>
${f.authors.length ? `<p class="body" style="margin:2px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.body};">${escapeHtml(authorsText(f.authors))}</p>` : ""}
<p class="muted" style="margin:3px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${LIGHT.muted};">${finishMeta(c, f)}${f.rating != null && c.look.ratingStyle !== "off" ? ` &nbsp;${stars(c, f.rating, 13)}` : ""}</p>
</td>
</tr>`,
    )
    .join("\n");
  const more =
    list.length > shown.length
      ? `<p class="muted" style="margin:14px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">And ${c.fmt(list.length - shown.length)} more.</p>`
      : "";
  return `${sectionTitle(title)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>${more}`;
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function calendarBlock(c: Ctx): string {
  const { s } = c;
  const startDay = c.look.weekStart === "monday" ? 1 : 0;
  const first = new Date(`${s.calendar[0].day}T00:00:00Z`).getUTCDay();
  const lead = (first - startDay + 7) % 7;
  const cells: (MonthSummary["calendar"][number] | null)[] = [...Array(lead).fill(null), ...s.calendar];
  while (cells.length % 7) cells.push(null);

  const head = Array.from({ length: 7 }, (_, i) => WEEKDAY_LETTERS[(startDay + i) % 7])
    .map(
      (l) =>
        `<td width="40" align="center" class="muted" style="width:40px;padding:0 0 2px;font-family:${SANS};font-size:11px;line-height:14px;font-weight:600;color:${LIGHT.muted};">${l}</td>`,
    )
    .join("");
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const tds = cells
      .slice(i, i + 7)
      .map((cell) => {
        if (!cell) return `<td width="40" height="40" style="width:40px;height:40px;">&nbsp;</td>`;
        const n = Number(cell.day.slice(8, 10));
        return `<td width="40" height="40" align="center" valign="middle" bgcolor="${LIGHT.heat[cell.level]}" class="h${cell.level}" style="width:40px;height:40px;border-radius:8px;background-color:${LIGHT.heat[cell.level]};font-family:${SANS};font-size:12px;line-height:14px;font-weight:600;color:${LIGHT.heatText[cell.level]};">${n}</td>`;
      })
      .join("");
    rows.push(`<tr>${tds}</tr>`);
  }

  const legend = LIGHT.heat
    .map(
      (colour, i) =>
        `<td width="12" height="12" bgcolor="${colour}" class="h${i}" style="width:12px;height:12px;border-radius:3px;background-color:${colour};font-size:1px;line-height:1px;">&nbsp;</td>`,
    )
    .join("");

  const notes: string[] = [];
  if (s.biggestDay) {
    const amount =
      s.biggestDay.unit === "pages"
        ? `${c.fmt(s.biggestDay.amount)} ${s.biggestDay.amount === 1 ? "page" : "pages"}`
        : formatLength(s.biggestDay.amount);
    notes.push(`Most in a day: ${amount} on ${c.day(s.biggestDay.day)}`);
  }
  if (s.longestRun > 1) notes.push(`Longest run: ${c.fmt(s.longestRun)} days`);

  return `${sectionTitle("Your month, day by day")}
<table role="presentation" cellpadding="0" cellspacing="4" border="0" style="border-collapse:separate;margin:0 -4px;">
<tr>${head}</tr>
${rows.join("\n")}
</table>
<table role="presentation" cellpadding="0" cellspacing="3" border="0" style="border-collapse:separate;margin:10px -3px 0;">
<tr><td class="muted" style="padding:0 5px 0 0;font-family:${SANS};font-size:11px;line-height:12px;color:${LIGHT.muted};">Less</td>${legend}<td class="muted" style="padding:0 0 0 5px;font-family:${SANS};font-size:11px;line-height:12px;color:${LIGHT.muted};">More${s.calendarUnit === "minutes" ? " (time read)" : ""}</td></tr>
</table>
${notes.length ? `<p class="body" style="margin:14px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${LIGHT.body};">${escapeHtml(notes.join(" · "))}</p>` : ""}`;
}

/** A thin bar `percent` full. */
function bar(percent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled =
    p > 0
      ? `<td width="${p}%" height="6" bgcolor="${LIGHT.accent}" class="fill" style="width:${p}%;height:6px;background-color:${LIGHT.accent};font-size:1px;line-height:1px;${p < 100 ? "border-radius:3px 0 0 3px;" : "border-radius:3px;"}">&nbsp;</td>`
      : "";
  const empty =
    p < 100
      ? `<td height="6" bgcolor="${LIGHT.rule}" class="track" style="height:6px;background-color:${LIGHT.rule};font-size:1px;line-height:1px;${p > 0 ? "border-radius:0 3px 3px 0;" : "border-radius:3px;"}">&nbsp;</td>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${filled}${empty}</tr></table>`;
}

function goalsBlock(c: Ctx): string {
  const rows = c.s.goals
    .map((g, i) => {
      const of = `${c.fmt(g.done)} of ${goalAmount(g.target, g.unit, c.fmt)}`;
      return `<tr><td style="padding:${i ? 18 : 0}px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="ink" style="font-family:${SERIF};font-size:17px;line-height:23px;color:${LIGHT.ink};">${escapeHtml(g.label)}</td>
<td align="right" class="body" style="font-family:${SANS};font-size:13px;line-height:23px;color:${LIGHT.body};white-space:nowrap;">${escapeHtml(of)}${g.met ? ` <span class="accent" style="color:${LIGHT.accent};font-weight:600;">✓</span>` : ""}</td>
</tr></table>
<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>
${bar(g.target > 0 ? (g.done / g.target) * 100 : 0)}
${g.pace ? `<p class="muted" style="margin:8px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">${escapeHtml(g.pace)}</p>` : ""}
${!g.pace && g.met ? `<p class="muted" style="margin:8px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">Met${g.done > g.target && g.unit !== GoalUnit.DAYS ? `, with ${goalAmount(g.done - g.target, g.unit, c.fmt)} to spare` : ""}.</p>` : ""}
</td></tr>`;
    })
    .join("\n");
  return `${sectionTitle("Goals")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>`;
}

function readingBlock(c: Ctx): string {
  const rows = c.s.reading
    .map(
      (r, i) => `<tr>
<td width="52" valign="top" style="width:52px;padding:${i ? 14 : 0}px 14px 0 0;">${coverCell(c, r.book, 38)}</td>
<td valign="top" style="padding:${i ? 14 : 0}px 0 0;">
<p class="ink" style="margin:0;font-family:${SERIF};font-size:16px;line-height:22px;color:${LIGHT.ink};">${escapeHtml(r.book.title)}</p>
${r.book.authors.length ? `<p class="body" style="margin:1px 0 8px;font-family:${SANS};font-size:13px;line-height:18px;color:${LIGHT.body};">${escapeHtml(authorsText(r.book.authors))}</p>` : `<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>`}
${r.percent != null ? bar(r.percent) : ""}
${r.figure ? `<p class="muted" style="margin:6px 0 0;font-family:${SANS};font-size:12px;line-height:17px;color:${LIGHT.muted};">${escapeHtml(r.figure)}</p>` : ""}
</td>
</tr>`,
    )
    .join("\n");
  return `${sectionTitle("On the go")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>`;
}

function quoteBlock(c: Ctx): string {
  const q = c.s.quote!;
  const by = [q.book.title, authorsText(q.book.authors)].filter(Boolean).join(", ");
  return `${sectionTitle("From your quotes")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="3" bgcolor="${LIGHT.accent}" class="fill" style="width:3px;background-color:${LIGHT.accent};font-size:1px;line-height:1px;">&nbsp;</td>
<td style="padding:2px 0 2px 18px;">
<p class="ink" style="margin:0;font-family:${SERIF};font-style:italic;font-size:19px;line-height:29px;color:${LIGHT.ink};">“${escapeHtml(q.text)}”</p>
<p class="muted" style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">${escapeHtml(by)}</p>
</td>
</tr></table>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${LIGHT.accent}" class="btn" style="border-radius:999px;background-color:${LIGHT.accent};">
<a href="${escapeHtml(href)}" class="btn-text" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:14px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function darkStyles(): string {
  const heat = DARK.heat
    .map((bg, i) => `.h${i}{background-color:${bg}!important;color:${DARK.heatText[i]}!important;}`)
    .join("\n");
  const rules = `.bg{background-color:${DARK.page}!important;}
.card{background-color:${DARK.card}!important;border-color:${DARK.border}!important;}
.ink{color:${DARK.ink}!important;}
.body{color:${DARK.body}!important;}
.muted{color:${DARK.muted}!important;}
.accent{color:${DARK.accent}!important;}
.gold{color:${DARK.gold}!important;}
.rule,.track{background-color:${DARK.rule}!important;}
.fill,.btn{background-color:${DARK.accent}!important;}
.btn-text{color:#1b140e!important;}
.tag{border-color:${DARK.border}!important;color:${DARK.muted}!important;}
.link{color:${DARK.accent}!important;}
${heat}`;
  // Apple Mail and others follow the media query; Outlook's own dark mode
  // marks the message with data-ogsc / data-ogsb instead. Each in a style
  // block of its own: Gmail drops a whole block over a rule it doesn't
  // take, and the first block's phone padding should survive that.
  const ogsc = rules.replace(/(^|\n|,)\./g, "$1[data-ogsc] .");
  return `<style>\n@media (prefers-color-scheme: dark){${rules}}\n</style>\n<style>\n${ogsc}\n</style>`;
}

/** The line after the subject: "18 reading days, 6 in a row at best, and
 *  Piranesi was your favourite." */
function preheaderText(s: MonthSummary, fmt: (n: number) => string): string {
  const bits = [`${fmt(s.readingDays)} reading ${s.readingDays === 1 ? "day" : "days"}`];
  if (s.longestRun > 1) bits.push(`${fmt(s.longestRun)} in a row at best`);
  const last = s.favourite
    ? `${s.favourite.title} was your favourite`
    : s.finishes.length === 1
      ? `you finished ${s.finishes[0].title}`
      : s.finishes.length > 1
        ? `${fmt(s.finishes.length)} books finished`
        : null;
  if (!last) return `${bits.join(", ")}.`;
  return `${bits.join(", ")}${bits.length > 1 ? "," : ""} and ${last}.`;
}

/** The email for one month's summary. `cover` gives the picture for a
 *  book (cid: in the message, data: in the preview) or null. */
export function renderMonthlyEmail(
  s: MonthSummary,
  look: EmailLook,
  links: EmailLinks,
  cover: (book: EmailBook) => string | null,
): RenderedEmail {
  const fmt = (n: number) => formatNumber(n, { numberFormat: look.numberFormat });
  const c: Ctx = { s, look, links, cover, fmt, day: (key) => formatDayMonth(key, look.dateFormat) };
  const name = monthName(s.month);
  const quiet = quietMonth(s);
  const year = s.month.slice(0, 4);

  const subject = quiet
    ? `Your ${name} in books`
    : `Your ${name} in books: ${s.books > 0 ? `${fmt(s.books)} finished, ` : ""}${fmt(s.pages)} ${s.pages === 1 ? "page" : "pages"}`;

  const preheader = quiet ? "A quiet month. Your books will keep." : preheaderText(s, fmt);

  const sections: string[] = [];
  const extras: string[] = [];
  if (s.started > 0) extras.push(`started ${fmt(s.started)} ${s.started === 1 ? "book" : "books"}`);
  if (s.added > 0) extras.push(`added ${fmt(s.added)} to your library`);
  const extraLine = extras.length
    ? `<p class="muted" style="margin:0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">You ${escapeHtml(extras.join(" and "))}.</p>`
    : "";
  const header = `<p class="accent" style="margin:0;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;color:${LIGHT.accent};">${escapeHtml(monthTitle(s.month))}</p>
<h1 class="ink" style="margin:10px 0 0;font-family:${SERIF};font-size:36px;line-height:42px;font-weight:normal;color:${LIGHT.ink};">Your ${escapeHtml(name)} in books</h1>
<div class="fill" style="width:44px;height:2px;line-height:2px;font-size:2px;background-color:${LIGHT.accent};margin:18px 0 18px;">&nbsp;</div>
<p class="body" style="margin:0${quiet && !extraLine ? "" : " 0 28px"};font-family:${SERIF};font-size:17px;line-height:26px;color:${LIGHT.body};">${
    quiet
      ? `Hi ${escapeHtml(s.name)}, ${escapeHtml(name)} was a quiet month, with no reading logged. Your books will be right where you left them.`
      : `Hi ${escapeHtml(s.name)}, here’s how your month of reading went.`
  }</p>`;
  sections.push(section(`${header}${quiet ? extraLine : `${statsBlock(c)}${extraLine}`}`, true));

  const putDown = s.putDown.length
    ? `<p class="muted" style="margin:0;font-family:${SANS};font-size:13px;line-height:19px;color:${LIGHT.muted};">Put down: ${escapeHtml(s.putDown.map((b) => b.title).join(", "))}.</p>`
    : "";
  const spaced = (html: string) => (html ? `<div style="height:20px;line-height:20px;font-size:1px;">&nbsp;</div>${html}` : "");
  if (s.favourite) {
    const rest = s.finishes.filter((f) => f !== s.favourite);
    sections.push(section(`${favouriteBlock(c, s.favourite)}${rest.length ? "" : spaced(putDown)}`));
    if (rest.length) sections.push(section(`${finishList(c, rest, "Also finished")}${spaced(putDown)}`));
  } else if (s.finishes.length) {
    sections.push(section(`${finishList(c, s.finishes, `Finished in ${name}`)}${spaced(putDown)}`));
  } else if (putDown) {
    sections.push(section(putDown));
  }
  if (!quiet) sections.push(section(calendarBlock(c)));
  if (s.goals.length) sections.push(section(goalsBlock(c)));
  if (s.reading.length) sections.push(section(readingBlock(c)));
  if (s.quote) sections.push(section(quoteBlock(c)));

  const december = s.month.endsWith("-12");
  if (links.site) {
    const href = december ? `${links.site}/stats/year/${year}` : `${links.site}/stats`;
    sections.push(
      `<tr><td class="px" style="padding:34px 40px 0;">${button(href, december ? `See your ${year} in books` : "See all your stats")}</td></tr>`,
    );
  }

  const linkStyle = `color:${LIGHT.muted};text-decoration:underline;`;
  const footerLinks = links.site
    ? `<a href="${escapeHtml(`${links.site}/account#monthly-email`)}" class="muted" style="${linkStyle}">Change it in MyReads</a>${
        links.unsubscribe
          ? ` &nbsp;·&nbsp; <a href="${escapeHtml(links.unsubscribe)}" class="muted" style="${linkStyle}">Stop these emails</a>`
          : ""
      }`
    : "To stop it, turn off Monthly email under Account › Preferences in MyReads.";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{color:${LIGHT.accent};}
@media (max-width:620px){
.container{width:100%!important;}
.px{padding-left:22px!important;padding-right:22px!important;}
.card{border-radius:0!important;border-left:0!important;border-right:0!important;}
}
</style>
${darkStyles()}
<!--[if mso]><style>td,p,a,h1{font-family:Georgia,serif!important;}</style><![endif]-->
</head>
<body class="bg" style="margin:0;padding:0;background-color:${LIGHT.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${LIGHT.page};">${escapeHtml(preheader)}${"&#8199;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${LIGHT.page}" class="bg" style="background-color:${LIGHT.page};">
<tr><td align="center" style="padding:28px 0 36px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="width:100%;max-width:600px;border-collapse:separate;">
<tr><td align="center" style="padding:0 0 18px;">
<p class="muted" style="margin:0;font-family:${SERIF};font-style:italic;font-size:17px;line-height:22px;color:${LIGHT.muted};">MyReads</p>
</td></tr>
<tr><td class="card" bgcolor="${LIGHT.card}" style="background-color:${LIGHT.card};border:1px solid ${LIGHT.border};border-radius:12px;padding:40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${sections.join("\n")}
</table>
</td></tr>
<tr><td class="px" align="center" style="padding:24px 40px 0;">
<p class="muted" style="margin:0;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.muted};">You get this on the 1st of each month because you turned on the monthly email in MyReads.</p>
<p class="muted" style="margin:6px 0 0;font-family:${SANS};font-size:12px;line-height:19px;color:${LIGHT.muted};">${footerLinks}</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  return { subject, preheader, html, text: renderText(c, subject, quiet) };
}

/** The same email as plain text, for mail apps that don't show HTML. */
function renderText(c: Ctx, subject: string, quiet: boolean): string {
  const { s, fmt, links } = c;
  const lines: string[] = [subject, "=".repeat(Math.min(subject.length, 60)), ""];
  const name = monthName(s.month);
  if (quiet) {
    lines.push(`Hi ${s.name}, ${name} was a quiet month, with no reading logged. Your books will be right where you left them.`, "");
  } else {
    lines.push(`Hi ${s.name}, here’s how your month of reading went.`, "");
    lines.push(`Books finished: ${fmt(s.books)}`);
    lines.push(`Pages read: ${fmt(s.pages)}`);
    lines.push(`Reading days: ${fmt(s.readingDays)} of ${fmt(s.calendar.length)}${s.longestRun > 1 ? ` (${fmt(s.longestRun)} in a row at best)` : ""}`);
    if (s.minutes > 0) lines.push(`Time read: ${formatLength(s.minutes)}`);
    if (s.biggestDay) {
      const amount = s.biggestDay.unit === "pages" ? `${fmt(s.biggestDay.amount)} pages` : formatLength(s.biggestDay.amount);
      lines.push(`Most in a day: ${amount} on ${c.day(s.biggestDay.day)}`);
    }
    lines.push("");
  }
  const book = (f: MonthFinish) => {
    const rating = ratingText(f.rating, c.look.ratingStyle);
    const by = f.authors.length ? ` by ${authorsText(f.authors)}` : "";
    return `- ${f.title}${by}${f.isReread ? " (re-read)" : ""}, finished ${c.day(f.day)}${rating ? `, ${rating}` : ""}`;
  };
  if (s.favourite) {
    lines.push("Book of the month", book(s.favourite), "");
    const rest = s.finishes.filter((f) => f !== s.favourite);
    if (rest.length) lines.push("Also finished", ...rest.map(book), "");
  } else if (s.finishes.length) {
    lines.push(`Finished in ${name}`, ...s.finishes.map(book), "");
  }
  if (s.putDown.length) lines.push(`Put down: ${s.putDown.map((b) => b.title).join(", ")}.`, "");
  if (s.goals.length) {
    lines.push("Goals");
    for (const g of s.goals) {
      lines.push(`- ${g.label}: ${fmt(g.done)} of ${goalAmount(g.target, g.unit, fmt)}${g.met ? " (met)" : ""}${g.pace ? `. ${g.pace}` : ""}`);
    }
    lines.push("");
  }
  if (s.reading.length) {
    lines.push("On the go");
    for (const r of s.reading) lines.push(`- ${r.book.title}${r.figure ? `: ${r.figure}` : ""}`);
    lines.push("");
  }
  if (s.quote) lines.push("From your quotes", `“${s.quote.text}”`, `  ${s.quote.book.title}`, "");
  if (links.site) lines.push(`Your stats: ${links.site}/stats`, "");
  lines.push("You get this on the 1st of each month because you turned on the monthly email in MyReads.");
  if (links.unsubscribe) lines.push(`Stop these emails: ${links.unsubscribe}`);
  else lines.push("To stop it, turn off Monthly email under Account › Preferences.");
  return lines.join("\n");
}
