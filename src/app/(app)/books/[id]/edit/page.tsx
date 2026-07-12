import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateBook } from "@/lib/actions/books";
import { BookForm } from "@/components/book-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit book · Bibliotek" };

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id } = await params;

  const book = await prisma.book.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!book) notFound();

  // Bind the id server-side so the client form can't target another row.
  const action = updateBook.bind(null, book.id);

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit “{book.title}”
      </h1>
      <BookForm
        action={action}
        submitLabel="Save changes"
        initial={{
          title: book.title,
          authors: book.authors.join(", "),
          isbn: book.isbn ?? "",
          description: book.description ?? "",
          coverUrl: book.coverUrl ?? "",
          pageCount: book.pageCount?.toString() ?? "",
          publishedDate: book.publishedDate ?? "",
          tags: book.tags.join(", "),
          format: book.format,
          owned: book.owned,
        }}
      />
    </div>
  );
}
