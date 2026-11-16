import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPreferences, getSession } from "@/lib/current-user";
import { formatNumber } from "@/lib/display";
import {
  AUTHORS_PAGE_SIZE,
  AUTHOR_SHOW,
  AUTHOR_SHOW_LABELS,
  AUTHOR_SORTS,
  AUTHOR_SORT_LABELS,
  buildAuthorList,
  inAuthorTab,
  matchesAuthorQuery,
  parseAuthorShow,
  parseAuthorSort,
  sortAuthors,
  type AuthorShow,
  type AuthorSort,
} from "@/lib/authors-list";
import { cn } from "@/lib/utils";
import { AuthorCard } from "@/components/author-card";
import { SeriesArrival } from "@/components/series-arrival";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authors · MyReads" };

/** The page's address with these choices, leaving out the defaults. */
function authorsHref(show: AuthorShow, sort: AuthorSort, q: string, all = false): string {
  const params = new URLSearchParams();
  if (show !== "all") params.set("show", show);
  if (sort !== "most") params.set("sort", sort);
  if (q) params.set("q", q);
  if (all) params.set("all", "1");
  const s = params.toString();
  return s ? `/authors?${s}` : "/authors";
}

/**
 * Every author in the library on one page: how many of their books are
 * read, what they were rated, and what of theirs is still waiting. The
 * most-read come first; tabs narrow it to authors with books waiting or
 * not read yet, and a search box finds one by name.
 */
export default async function AuthorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const [sp, prefs] = await Promise.all([searchParams, getPreferences()]);
  const show = parseAuthorShow(sp.show);
  const sort = parseAuthorSort(sp.sort);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 200) ?? "";
  const showAll = sp.all === "1" || q !== "";

  const books = await prisma.book.findMany({
    where: { userId, NOT: { authors: { isEmpty: true } } },
    select: {
      id: true,
      title: true,
      authors: true,
      coverUrl: true,
      status: true,
      ownership: true,
      rating: true,
      timesRead: true,
      pageCount: true,
      dateFinished: true,
      seriesName: true,
      seriesNumber: true,
      upNextRank: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const all = buildAuthorList(books);
  const sortOpts = {
    authorOrder: prefs.authorOrder,
    alphabet: prefs.sortAlphabet,
  };
  const counts = Object.fromEntries(
    AUTHOR_SHOW.map((s) => [s, all.filter((a) => inAuthorTab(a, s)).length]),
  ) as Record<AuthorShow, number>;
  const matching = sortAuthors(
    all.filter((a) => inAuthorTab(a, show) && matchesAuthorQuery(a.name, q)),
    sort,
    sortOpts,
  );
  const shown = showAll ? matching : matching.slice(0, AUTHORS_PAGE_SIZE);
  const sorts = AUTHOR_SORTS.filter((s) => s !== "rating" || prefs.ratingStyle !== "off");

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Authors</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(all.length, prefs)} in your library
        </span>
      </div>

      {all.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No authors yet. Add a book with its author, and the author shows up here with how much
          of them you&apos;ve read.
        </p>
      ) : (
        <>
          <nav aria-label="Which authors" className="flex gap-1 overflow-x-auto border-b">
            {AUTHOR_SHOW.map((s) => (
              <Link
                key={s}
                href={authorsHref(s, sort, q)}
                prefetch={false}
                aria-current={show === s ? "page" : undefined}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  show === s && "border-primary font-medium text-foreground",
                )}
              >
                {AUTHOR_SHOW_LABELS[s]}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                  {formatNumber(counts[s], prefs)}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Order" className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="mr-1 text-muted-foreground max-sm:sr-only">Order:</span>
              {sorts.map((s) => (
                <Link
                  key={s}
                  href={authorsHref(show, s, q)}
                  prefetch={false}
                  aria-current={sort === s ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground",
                    sort === s && "border-primary bg-primary/10 font-medium text-foreground",
                  )}
                >
                  {AUTHOR_SORT_LABELS[s]}
                </Link>
              ))}
            </nav>
            <form action="/authors" role="search" className="relative w-full sm:w-64">
              {show !== "all" && <input type="hidden" name="show" value={show} />}
              {sort !== "most" && <input type="hidden" name="sort" value={sort} />}
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Find an author"
                aria-label="Find an author"
                className="pl-8"
              />
            </form>
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {q ? `No author here has “${q}” in their name.` : "No authors here."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {shown.map((a) => (
                <AuthorCard key={a.name} author={a} prefs={prefs} />
              ))}
              <SeriesArrival />
            </div>
          )}
          {shown.length < matching.length && (
            <p className="text-center text-sm">
              <Link
                href={authorsHref(show, sort, q, true)}
                prefetch={false}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Show all {formatNumber(matching.length, prefs)} authors
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
