import { Fragment } from "react";
import Link from "next/link";
import { fineText } from "@/lib/fine-type";

/** A book's authors, each a link to their books in the library. */
export function AuthorLinks({ authors }: { authors: string[] }) {
  return authors.map((a, i) => (
    <Fragment key={`${i}-${a}`}>
      {i > 0 && ", "}
      <Link
        href={`/books?author=${encodeURIComponent(a)}`}
        className="hover:text-foreground hover:underline"
      >
        {fineText(a)}
      </Link>
    </Fragment>
  ));
}
