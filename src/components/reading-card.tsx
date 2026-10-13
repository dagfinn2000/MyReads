"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Book, ProgressEntry } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { updateReading } from "@/lib/actions/books";
import { celebrate } from "@/lib/confetti";
import { STATUS_LABELS, toDateInputValue } from "@/lib/display";
import { usePreferences } from "@/components/preferences-provider";
import { currentPassEntries } from "@/lib/progress";
import { progressFigure, unitFor } from "@/lib/progress-units";
import { submitKeepingInput } from "@/lib/submit-form";
import { ProgressChart, ProgressLog } from "@/components/progress-log";
import { FinishedDateField } from "@/components/finished-date-field";
import { CurrentPageField } from "@/components/progress-input";
import { QuickLog } from "@/components/quick-log";
import { StarRatingInput } from "@/components/star-rating-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The "my reading of this book" panel on the detail page. On top, progress:
 * the bar in the book's unit, the quick-log row while the book is being
 * read, and the sparkline and pace drawn from the automatic reading log.
 * Then the form for status, star rating, dates and the personal review,
 * which saves through the updateReading server action, and the log itself.
 *
 * While the book is Currently Reading, progress is logged only through the
 * quick row (its own form, outside this one), and saving the reading form
 * keeps the book's page as the server has it (updateReading), so saving a
 * review never moves progress. Any other status keeps a progress box in the
 * form.
 */
export function ReadingCard({
  book,
  progress,
}: {
  /** Without the folded search copies, which have no business in the page. */
  book: Omit<Book, "searchText" | "reviewSearchText">;
  progress: ProgressEntry[];
}) {
  const action = updateReading.bind(null, book.id);
  const [state, formAction, pending] = useActionState(action, {});
  const prefs = usePreferences();
  const saveButton = useRef<HTMLButtonElement>(null);
  const info = unitFor(book, prefs);
  const reading = book.status === ReadingStatus.READING;

  // Finishing a book gets a burst of confetti from the save button. Each
  // save returns a new state object, so this runs once per save.
  useEffect(() => {
    if (state.finished) celebrate(saveButton.current);
  }, [state]);

  // Remount the form whenever the server-side reading data changes. A save
  // leaves the fields as they were sent (submitKeepingInput), so a failed
  // one keeps the review being typed; but the server may have saved
  // something else (Read fills in today's finish date), and a fresh mount
  // re-reads every default from the just-saved book. It also keeps the
  // Radix Select honest: its hidden native select reverts to its
  // *mount-time* value whenever the form is reset, behind React's back. When
  // nothing changed the key is stable and the form stays put. A quick log changes the page of a book being read without
  // touching the form, so then the page is left out: logging must not
  // remount the form and throw away a review being typed.
  const formKey = [
    book.status,
    book.rating ?? 0,
    book.dateStarted?.getTime() ?? 0,
    book.dateFinished?.getTime() ?? 0,
    reading ? "reading" : (book.currentPage ?? 0),
    book.review ?? "",
  ].join("|");

  // The sparkline shows the current pass; entries from earlier passes still
  // feed the stats heatmap and stay in the log below.
  const passEntries = currentPassEntries(progress, book.dateStarted, prefs.timeZone);
  const showBar = book.currentPage != null && !!book.pageCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My reading</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(showBar || reading || passEntries.length >= 2) && (
          <div className="grid gap-3">
            {showBar && (
              <div className="grid max-w-sm gap-1">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="bar-grow h-full rounded-full bg-primary/80"
                    style={{
                      width: `${Math.min((book.currentPage! / book.pageCount!) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {progressFigure(book.currentPage!, info)}
                </p>
              </div>
            )}
            {reading && <QuickLog book={book} />}
            <ProgressChart entries={passEntries} status={book.status} info={info} />
          </div>
        )}

        <form
          key={formKey}
          action={formAction}
          onSubmit={submitKeepingInput(formAction)}
          className="grid gap-4"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={book.status}>
                <SelectTrigger id="status" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ReadingStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Rating</Label>
              <StarRatingInput name="rating" defaultValue={book.rating ?? 0} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dateStarted">Started</Label>
              <Input
                id="dateStarted"
                name="dateStarted"
                type="date"
                className="w-40"
                defaultValue={toDateInputValue(book.dateStarted, prefs.timeZone)}
              />
            </div>
            <FinishedDateField
              defaultDate={toDateInputValue(book.dateFinished, prefs.timeZone)}
              defaultUnknown={book.status === ReadingStatus.READ && !book.dateFinished}
            />
            {reading ? (
              // Ignored while the book is still being read (the server keeps
              // its own page); it matters only if another tab has moved the
              // book off Currently Reading since.
              <input type="hidden" name="currentPage" value={book.currentPage ?? ""} />
            ) : (
              <CurrentPageField bookId={book.id} info={info} initialPage={book.currentPage} />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="review">Review / notes</Label>
            <Textarea
              id="review"
              name="review"
              rows={5}
              className="long-text"
              placeholder="What did you think?"
              defaultValue={book.review ?? ""}
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button ref={saveButton} type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save reading data"}
            </Button>
            {state.success && (
              <span className="text-sm text-muted-foreground">Saved ✓</span>
            )}
          </div>
        </form>

        {progress.length > 0 && (
          <div className="border-t pt-3">
            <ProgressLog entries={progress} book={book} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
