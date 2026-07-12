"use client";

import { useActionState } from "react";
import type { Book } from "@prisma/client";
import { ReadingStatus } from "@prisma/client";
import { updateReading } from "@/lib/actions/books";
import { STATUS_LABELS, toDateInputValue } from "@/lib/display";
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
 * rating, dates, re-read count, and the personal review. Saves through the
 * updateReading server action.
 */
export function ReadingCard({ book }: { book: Book }) {
  const action = updateReading.bind(null, book.id);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>My reading</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
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
              <Label htmlFor="timesRead">Times read</Label>
              <Input
                id="timesRead"
                name="timesRead"
                type="number"
                min={0}
                className="w-24"
                defaultValue={book.timesRead}
              />
            </div>
          </div>

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
      </CardContent>
    </Card>
  );
}
