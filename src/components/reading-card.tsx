"use client";

import { useActionState } from "react";
import type { Book, ProgressEntry } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { updateReading } from "@/lib/actions/books";
import { STATUS_LABELS, toDateInputValue } from "@/lib/display";
import { currentPassEntries } from "@/lib/progress";
import { ProgressChart, ProgressLog } from "@/components/progress-log";
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
 * The "my reading of this book" panel on the detail page: status, star
 * rating, dates, progress (with the sparkline and pace drawn from the
 * automatic reading log), and the personal review. Saves through the
 * updateReading server action.
 */
export function ReadingCard({
  book,
  progress,
}: {
  book: Book;
  progress: ProgressEntry[];
}) {
  const action = updateReading.bind(null, book.id);
  const [state, formAction, pending] = useActionState(action, {});

  // Remount the form whenever the server-side reading data changes. React
  // resets uncontrolled fields after a successful action, and the Radix
  // Select's hidden native select reverts to its *mount-time* value behind
  // React's back (a controlled value prop doesn't help — React never sees
  // the DOM change), so a second save without a remount would silently
  // submit the stale status. A fresh mount re-reads every default from the
  // just-saved book; when nothing changed the key is stable and the form
  // stays put.
  const formKey = [
    book.status,
    book.rating ?? 0,
    book.dateStarted?.getTime() ?? 0,
    book.dateFinished?.getTime() ?? 0,
    book.currentPage ?? 0,
    book.review ?? "",
  ].join("|");

  // The sparkline shows the current pass; entries from earlier passes still
  // feed the stats heatmap and stay in the log below.
  const passEntries = currentPassEntries(progress, book.dateStarted);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My reading</CardTitle>
      </CardHeader>
      <CardContent>
        <form key={formKey} action={formAction} className="grid gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select name="status" defaultValue={book.status}>
                <SelectTrigger className="w-44">
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
                defaultValue={toDateInputValue(book.dateStarted)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateFinished">Finished</Label>
              <Input
                id="dateFinished"
                name="dateFinished"
                type="date"
                className="w-40"
                defaultValue={toDateInputValue(book.dateFinished)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currentPage">
                Current page{book.pageCount ? ` (of ${book.pageCount})` : ""}
              </Label>
              <Input
                id="currentPage"
                name="currentPage"
                type="number"
                min={0}
                max={100000}
                className="w-28"
                defaultValue={book.currentPage ?? ""}
                placeholder="—"
              />
            </div>
          </div>

          {book.currentPage != null && book.pageCount ? (
            <div className="grid max-w-sm gap-1">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{
                    width: `${Math.min((book.currentPage / book.pageCount) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {Math.min(Math.round((book.currentPage / book.pageCount) * 100), 100)}% read
              </p>
            </div>
          ) : null}

          <ProgressChart
            entries={passEntries}
            pageCount={book.pageCount}
            status={book.status}
          />

          <div className="grid gap-2">
            <Label htmlFor="review">Review / notes</Label>
            <Textarea
              id="review"
              name="review"
              rows={5}
              placeholder="What did you think?"
              defaultValue={book.review ?? ""}
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save reading data"}
            </Button>
            {state.success && (
              <span className="text-sm text-muted-foreground">Saved ✓</span>
            )}
          </div>
        </form>

        {progress.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <ProgressLog entries={progress} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
