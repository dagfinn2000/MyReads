import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

/**
 * POST /api/register — create a new account.
 *
 * Open by default so first-run setup is painless; set DISABLE_REGISTRATION=true
 * once your own account exists if the instance is reachable from the internet.
 */
export async function POST(req: Request) {
  if (process.env.DISABLE_REGISTRATION === "true") {
    return NextResponse.json(
      { error: "Registration is disabled on this instance" },
      { status: 403 },
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

  const username = parsed.data.username.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({ data: { username, passwordHash } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
