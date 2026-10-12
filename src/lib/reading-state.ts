import { ReadingStatus } from "@prisma/client";

/**
 * What changing a book's reading status implies for the rest of its reading
 * fields. One function, so the three ways of setting a status (the reading
 * card, the add form's shelf picker, and bulk edit) can't disagree. They
 * used to: only the reading card filled in the finish date and timesRead, so
 * a book added as Read, or bulk-moved to Read, counted in "Books read" but
 * not in the year it was read or toward that year's goal.
 */
export interface ReadingState {
  status: ReadingStatus;
  dateStarted: Date | null;
  dateFinished: Date | null;
  currentPage: number | null;
}

export function settleReadingState(
  /** The status before this change; null for a book being created. */
  prevStatus: ReadingStatus | null,
  next: ReadingState,
  /** Earlier passes archived in the Read table. */
  archivedReads: number,
  now: Date = new Date(),
  opts: {
    /** A Read book with no date given stays undated instead of being
     *  finished today: the reader said they don't remember, or chose that
     *  in Preferences (New books). */
    undatedFinish?: boolean;
  } = {},
): ReadingState & { timesRead: number } {
  const { status } = next;

  // Marking a book Read without saying when means "finished today". Without
  // a date it can't count toward any year's stats or goal, which is what an
  // undated finish asks for. A book that was already Read and is saved
  // without a date stays undated too, so a later save (a new rating, say)
  // never stamps today on a book whose date nobody remembers.
  let dateFinished = next.dateFinished;
  if (status === ReadingStatus.READ && !next.dateFinished) {
    dateFinished = opts.undatedFinish || prevStatus === ReadingStatus.READ ? null : now;
  }

  // Starting a book without saying when means "started today", the same
  // convenience in the other direction. Only from Want to Read (or a new
  // book): a book resumed from Did Not Finish, or one already on the go, has
  // log entries the progress bookkeeping places relative to its start date,
  // and moving that date to today would re-credit them.
  const starting = prevStatus === null || prevStatus === ReadingStatus.WANT_TO_READ;
  const dateStarted =
    status === ReadingStatus.READING && !next.dateStarted && starting ? now : next.dateStarted;

  // Progress only makes sense mid-book: kept for Reading and Did Not Finish
  // ("stopped at p. 218"), cleared when finished or back on the shelf.
  const keepsProgress = status === ReadingStatus.READING || status === ReadingStatus.DNF;
  const currentPage = keepsProgress ? next.currentPage || null : null;

  // Derived, never submitted: archived passes plus the current one when
  // it's finished.
  const timesRead = archivedReads + (status === ReadingStatus.READ ? 1 : 0);

  return { status, dateStarted, dateFinished, currentPage, timesRead };
}
