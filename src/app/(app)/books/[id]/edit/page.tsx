import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateBook } from "@/lib/actions/books";
import { getPreferences } from "@/lib/current-user";
import { tagImportFor } from "@/lib/user-tags";
import { BookForm } from "@/components/book-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit book · MyReads" };

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const { id } = await params;

  const [book, seriesRows] = await Promise.all([
    prisma.book.findFirst({
      where: { id, userId: session.user.id },
    }),
    // Existing series names, for the form's autocomplete suggestions.
    prisma.book.findMany({
      where: { userId: session.user.id, seriesName: { not: null } },
      select: { seriesName: true },
      distinct: ["seriesName"],
      orderBy: { seriesName: "asc" },
    }),
  ]);
  if (!book) notFound();
  const seriesNames = seriesRows
    .map((r) => r.seriesName)
    .filter((s): s is string => !!s);

  // Bind the id server-side so the client form can't target another row.
  const action = updateBook.bind(null, book.id);
  // How "Look up details" turns catalogue subjects into tags.
  const lookup = await tagImportFor(session.user.id, await getPreferences());

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">
        Edit “{book.title}”
      </h1>
      <BookForm
        action={action}
        submitLabel="Save changes"
        seriesNames={seriesNames}
        lookup={lookup}
        initial={{
          title: book.title,
          authors: book.authors.join(", "),
          isbn: book.isbn ?? "",
          description: book.description ?? "",
          coverUrl: book.coverUrl ?? "",
          pageCount: book.pageCount?.toString() ?? "",
          lengthMinutes: book.lengthMinutes?.toString() ?? "",
          publishedDate: book.publishedDate ?? "",
          tags: book.tags.join(", "),
          seriesName: book.seriesName ?? "",
          seriesNumber: book.seriesNumber?.toString() ?? "",
          format: book.format,
          ownership: book.ownership,
          openLibraryId: book.openLibraryId ?? "",
        }}
      />
    </div>
  );
}
