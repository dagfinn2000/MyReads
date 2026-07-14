import { auth } from "@/auth";
import { CheckBookClient } from "@/components/check-book-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Do I own this? · MyReads" };

/**
 * Bookstore mode: scan a barcode (or type an ISBN) and instantly see
 * whether the book is already in the library — the exact edition via ISBN,
 * or the same title as a different edition via the metadata sources.
 */
export default async function CheckBookPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Do I own this?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Standing in a bookstore? Scan the barcode on the back — or type the
          ISBN — to check your library before buying a book twice.
        </p>
      </div>
      <CheckBookClient />
    </div>
  );
}
