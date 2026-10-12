import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { ownershipParam } from "@/lib/check-verdict";
import { tagImportFor } from "@/lib/user-tags";
import { AddBookClient } from "@/components/add-book-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add book · MyReads" };

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<{ isbn?: string; ownership?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  // Handoff from the "do I own this?" page: ?isbn= seeds the import search,
  // and "Add to wishlist" adds ?ownership=WISHLIST over the usual default.
  const { isbn, ownership } = await searchParams;

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
  const prefs = await getPreferences();
  // How catalogue subjects become tags: the import mode and tag rules, plus
  // the library's own tags when only those are wanted.
  const tagImport = await tagImportFor(session.user.id, prefs);

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add book</h1>
      <AddBookClient
        seriesNames={seriesNames}
        initialIsbn={isbn}
        defaults={{
          format: prefs.newBookFormat,
          status: prefs.newBookStatus,
          ownership: ownershipParam(ownership) ?? prefs.newBookOwnership,
        }}
        tagImport={tagImport}
      />
    </div>
  );
}
