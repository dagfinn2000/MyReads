import { NextResponse, type NextRequest } from "next/server";
import { escapeHtml } from "@/lib/monthly-email-html";
import { unsubscribeTokenOk } from "@/lib/monthly-email-run";
import { parsePreferences } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";

/**
 * /api/email/unsubscribe?u=<account>&t=<key>: the monthly email's "Stop
 * these emails", which works without signing in (the email is often read
 * on a phone that isn't). The key is tied to the account and the address
 * the email went to (monthly-email-run.ts), so only that email's link
 * works, and stops working once the address changes.
 *
 * Opening the link shows a button rather than stopping the email at once:
 * mail scanners open links to look at them, and that mustn't count. Mail
 * apps' own Unsubscribe button POSTs here directly (RFC 8058).
 */

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · MyReads</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2ece2;color:#2b2420;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
main{max-width:26rem;margin:2rem 1.25rem;padding:2.5rem 2rem;background:#fffdf8;border:1px solid #e6ddcf;border-radius:12px;text-align:center;}
.brand{margin:0 0 1.5rem;font:italic 17px Georgia,serif;color:#7a6d62;}
h1{margin:0 0 .75rem;font:normal 26px/1.25 Georgia,serif;}
p{margin:0 0 1rem;color:#4a4039;}
button{margin-top:.5rem;padding:.75rem 1.6rem;border:0;border-radius:999px;background:#8f3d2b;color:#fff;font-family:inherit;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;}
button:focus-visible{outline:2px solid #8f3d2b;outline-offset:3px;}
@media (prefers-color-scheme:dark){body{background:#16120f;color:#f3ebe0;}main{background:#221d19;border-color:#3a322b;}p{color:#d8ccbd;}.brand{color:#a6988a;}button{background:#e39478;color:#1b140e;}}
</style>
</head>
<body><main><p class="brand">MyReads</p><h1>${escapeHtml(title)}</h1>${body}</main></body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const GONE = page(
  "This link no longer works",
  "<p>It may be from an older email. You can turn the monthly email off in MyReads, under Account › Preferences › Monthly email.</p>",
  404,
);

/** The account the link is for, when its key is right. */
async function linkAccount(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("u") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!userId || !token || userId.length > 100 || token.length > 100) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, preferences: true } });
  if (!user) return null;
  const prefs = parsePreferences(user.preferences);
  if (!prefs.emailAddress || !unsubscribeTokenOk(user.id, prefs.emailAddress, token)) return null;
  return { id: user.id, on: prefs.monthlyEmail };
}

export async function GET(req: NextRequest) {
  const account = await linkAccount(req);
  if (!account) return GONE;
  if (!account.on) {
    return page("You’re all set", "<p>The monthly email is already off. You can turn it back on in MyReads, under Account › Preferences.</p>");
  }
  // Posts back to this same address, key and all.
  return page(
    "Stop the monthly email?",
    `<p>You won’t get the summary of your month on the 1st any more. You can turn it back on in MyReads whenever you like.</p>
<form method="post"><button type="submit">Stop the monthly email</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  const account = await linkAccount(req);
  if (!account) return GONE;
  await prisma.$executeRaw`
    UPDATE "User"
    SET "preferences" = COALESCE("preferences", '{}'::jsonb) || '{"monthlyEmail": false}'::jsonb
    WHERE "id" = ${account.id}`;
  return page("The monthly email is off", "<p>You won’t get any more. You can turn it back on in MyReads, under Account › Preferences.</p>");
}
