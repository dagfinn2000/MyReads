import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPreferences } from "@/lib/current-user";
import { formatNumber } from "@/lib/display";
import { sortBooks } from "@/lib/library-sort";
import { caseCount, shelve, spineFor, type RoomBook } from "@/lib/room";
import { RoomView } from "@/components/room-view";
import { RoomSwitch } from "@/components/room-switch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reading room · MyReads" };

/**
 * The reading room: the whole library as a little pixel-art house, every
 * book a spine on a shelf, filed by author the way a bookshelf is. The
 * house grows with the library (components/reading-room.tsx), and is
 * decorated as the reader likes (components/room-view.tsx).
 */
export default async function ReadingRoomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login"); // revoked session (see auth.ts)
  const userId = session.user.id;
  const prefs = await getPreferences();
  if (prefs.hiddenNav.includes("room")) {
    // Turned off in Preferences: no house, just the way back to it.
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reading room</h1>
        <p className="text-sm text-muted-foreground">
          The reading room is turned off, so your books aren&apos;t drawn as a house here, and the Room tab is
          hidden.
        </p>
        <RoomSwitch hiddenNav={prefs.hiddenNav} on />
      </div>
    );
  }

  const rows = await prisma.book.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      authors: true,
      coverUrl: true,
      pageCount: true,
      currentPage: true,
      status: true,
      ownership: true,
      seriesName: true,
      seriesNumber: true,
      // The rest of what sortBooks reads; only the author order is used.
      rating: true,
      dateFinished: true,
      dateStarted: true,
      publishedDate: true,
      createdAt: true,
      updatedAt: true,
      loans: {
        where: { returnedAt: null },
        select: { borrower: true },
        orderBy: { lentAt: "desc" },
        take: 1,
      },
    },
  });

  const sorted = sortBooks(rows, "author", "asc", {
    ignoreArticles: prefs.ignoreArticles,
    authorOrder: prefs.authorOrder,
    alphabet: prefs.sortAlphabet,
  });
  // Only what the room draws goes to the browser.
  const books: RoomBook[] = sorted.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.authors.join(", "),
    coverUrl: b.coverUrl,
    pageCount: b.pageCount,
    currentPage: b.currentPage,
    status: b.status,
    ownership: b.ownership,
    lentTo: b.loans[0]?.borrower ?? null,
  }));
  const cases = caseCount(shelve(books.map((b) => spineFor(b).width)).length);

  return (
    <div className="grid gap-4">
      <RoomView
        books={books}
        decor={{
          style: prefs.roomStyle,
          walls: prefs.roomWalls,
          wood: prefs.roomWood,
          fabric: prefs.roomFabric,
          hanging: prefs.roomHanging,
          paper: prefs.roomPaper,
          floor: prefs.roomFloor,
          ceiling: prefs.roomCeiling,
          own: prefs.roomOwn,
          cat: prefs.roomCat,
          dog: prefs.roomDog,
        }}
        layout={prefs.roomLayout}
        avatar={prefs.avatar}
        avatarShown={prefs.avatarShown}
        avatarLooks={prefs.avatarLooks}
        pet={prefs.avatarPet}
        hiddenNav={prefs.hiddenNav}
        away={prefs.roomAway}
        rooms={prefs.roomRooms}
        extras={prefs.roomExtras}
        summary={
          books.length > 0
            ? `${books.length === 1 ? "1 book" : `${formatNumber(books.length, prefs)} books`} on ${
                cases === 1 ? "1 bookcase" : `${formatNumber(cases, prefs)} bookcases`
              }`
            : null
        }
      />
      {books.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          The shelves are waiting.{" "}
          <Link href="/books/new" className="underline underline-offset-2 hover:text-foreground">
            Add a book
          </Link>{" "}
          and it will be the first spine on them.
        </p>
      ) : (
        <p className="mx-auto max-w-prose text-center text-xs text-muted-foreground">
          Books are filed by author. An outline keeps the place of a book that isn&apos;t on the
          shelf right now: wished for, lent out or given away. A red ribbon marks a book
          you&apos;re reading. The room gets more furniture as your library grows, and
          Decorate changes its style and colours, adds rooms and furniture, moves it
          about, and makes the little you who lives there.
        </p>
      )}
    </div>
  );
}
