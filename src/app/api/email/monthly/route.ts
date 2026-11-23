import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { isMonthKey, lastMonth } from "@/lib/monthly-email";
import { composeMonthlyEmail } from "@/lib/monthly-email-run";
import { parsePreferences, serverTimeZone } from "@/lib/preferences";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/email/monthly?month=2026-10: the monthly email for that month
 * (last month by default) as a page, exactly as it would be sent but with
 * the covers inside the page. Preferences › Monthly email's Preview opens
 * it; it works whether or not this server can send email.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, preferences: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = parsePreferences(user.preferences);
  const latest = lastMonth(new Date(), prefs.timeZone || serverTimeZone());
  const asked = req.nextUrl.searchParams.get("month");
  const month = isMonthKey(asked) && asked <= latest ? asked : latest;

  const { rendered } = await composeMonthlyEmail(user, prefs, month, { inlineAsData: true });
  return new NextResponse(rendered.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // The page is the email: nothing in it runs, and its pictures are
      // inside it.
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
