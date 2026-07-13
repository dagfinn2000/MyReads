import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/export — downloads the signed-in user's entire library as JSON:
 * every book (with its shelf names), every shelf, and reading goals. A
 * one-click offsite backup for a self-hosted instance; cover image files are
 * not included (coverUrl paths reference the covers volume).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [books, shelves, readingGoals] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { shelves: { select: { name: true } } },
    }),
    prisma.shelf.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { name: true, createdAt: true },
    }),
    prisma.readingGoal.findMany({
      where: { userId },
      orderBy: { year: "asc" },
      select: { year: true, target: true },
    }),
  ]);

  const payload = {
    format: "myreads-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    username: session.user.name ?? null,
    counts: { books: books.length, shelves: shelves.length },
    shelves,
    readingGoals,
    books: books.map(({ userId: _userId, searchText: _searchText, ...book }) => ({
      ...book,
      shelves: book.shelves.map((s) => s.name),
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="myreads-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
