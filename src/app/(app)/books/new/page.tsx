import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AddBookClient } from "@/components/add-book-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add book · MyReads" };

export default async function NewBookPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Existing series names, for the form's autocomplete suggestions.
  const seriesRows = await prisma.book.findMany({
    where: { userId: session.user.id, seriesName: { not: null } },
    select: { seriesName: true },
    distinct: ["seriesName"],
    orderBy: { seriesName: "asc" },
  });
  const seriesNames = seriesRows
    .map((r) => r.seriesName)
    .filter((s): s is string => !!s);

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add book</h1>
      <AddBookClient seriesNames={seriesNames} />
    </div>
  );
}
