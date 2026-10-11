import Link from "next/link";
import { BookX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 404 page. Reached both by an unknown URL and by the `notFound()` calls on
 * the book, edit and year pages — asking for a book that isn't yours resolves
 * here, which is also what keeps those routes from confirming whether an id
 * exists at all.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <BookX className="size-12 text-muted-foreground/40" />
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            That page doesn&apos;t exist, or what it showed has been deleted.
          </p>
        </div>
        <Button asChild>
          <Link href="/books">Back to library</Link>
        </Button>
      </div>
    </div>
  );
}
