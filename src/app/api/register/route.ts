import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIp, registerLimiter } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

/**
 * POST /api/register — create a new account.
 *
 * Open by default so first-run setup is painless; set DISABLE_REGISTRATION=true
 * once your own account exists if the instance is reachable from the internet.
 * Rate-limited per IP either way, so an open instance can't be flooded with
 * junk accounts.
 */
export async function POST(req: Request) {
  if (process.env.DISABLE_REGISTRATION === "true") {
    return NextResponse.json(
      { error: "Registration is disabled on this instance" },
      { status: 403 },
    );
  }

  const ipKey = `register:${clientIp(req.headers)}`;
  if (registerLimiter.blocked(ipKey)) {
    return NextResponse.json(
      { error: "Too many registration attempts — try again later" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Count validated attempts, so both junk-account creation and probing
  // usernames via the "taken" error burn the budget. Malformed requests
  // above create nothing and stay free.
  registerLimiter.hit(ipKey);

  const username = parsed.data.username.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.user.create({ data: { username, passwordHash } });
  } catch (err) {
    // The check above is not atomic: two concurrent signups for the same name
    // both pass it, and the unique index rejects the loser. That's the
    // constraint doing its job — report it as the same conflict rather than
    // letting it surface as an unhandled 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
