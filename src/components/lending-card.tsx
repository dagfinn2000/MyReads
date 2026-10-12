"use client";

import { useActionState, useState, useTransition } from "react";
import type { BookOwnership, Loan } from "@prisma/client";
import { HandHeart, Trash2, Undo2 } from "lucide-react";
import { deleteLoan, lendBook, returnLoan } from "@/lib/actions/loans";
import type { ActionState } from "@/lib/actions/helpers";
import { formatDate, toDateInputValue } from "@/lib/display";
import { usePreferences } from "@/components/preferences-provider";
import { LENDING_NOTE, lendingMode, outFor, showsLendingCard } from "@/lib/loans";
import { submitKeepingInput } from "@/lib/submit-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Lending panel on the book detail page: who has your copy right now, a form
 * to lend it out, and the history of everyone who has borrowed it.
 *
 * The open loan (no `returnedAt`) is what makes a book "lent out", so it gets
 * the prominent treatment; returned loans collapse into a quiet list.
 *
 * Only a copy you own can be lent. A borrowed or given-away book says so
 * instead of offering "Lend out", and a wishlist book has no card at all
 * unless it has loans on record. Loans already made always show.
 */
export function LendingCard({
  bookId,
  ownership,
  loans,
}: {
  bookId: string;
  ownership: BookOwnership;
  /** Newest first. */
  loans: Loan[];
}) {
  const [showForm, setShowForm] = useState(false);
  const prefs = usePreferences();
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await lendBook(bookId, prev, formData);
      if (result.success) setShowForm(false);
      return result;
    },
    {},
  );

  const open = loans.find((l) => l.returnedAt === null) ?? null;
  const past = loans.filter((l) => l.returnedAt !== null);

  if (!showsLendingCard(ownership, loans.length)) return null;
  const mode = lendingMode(ownership);
  const canLend = mode === "lendable";
  // If the ownership changes while the form is open, the form hides and the
  // card falls back to its note rather than going blank.
  const formOpen = canLend && showForm && !open;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Lending</CardTitle>
        {canLend && !open && !formOpen && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <HandHeart data-slot="icon" />
            Lend out
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {open ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <div className="min-w-0">
              <p className="font-medium">Lent to {open.borrower}</p>
              <p className="text-muted-foreground">
                Since {formatDate(open.lentAt, prefs)} ·{" "}
                {outFor(new Date(open.lentAt), new Date())}
              </p>
              {open.note && (
                <p className="mt-1 break-words text-muted-foreground">{open.note}</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => startTransition(() => returnLoan(open.id))}
            >
              <Undo2 data-slot="icon" />
              Mark returned
            </Button>
          </div>
        ) : (
          !formOpen && (
            <p className="text-sm text-muted-foreground">{LENDING_NOTE[mode]}</p>
          )
        )}

        {formOpen && (
          <form
            action={formAction}
            onSubmit={submitKeepingInput(formAction)}
            className="grid gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <div className="grid gap-2">
                <Label htmlFor="borrower">Lent to</Label>
                <Input
                  id="borrower"
                  name="borrower"
                  placeholder="Name"
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lentAt">Date</Label>
                <Input
                  id="lentAt"
                  name="lentAt"
                  type="date"
                  defaultValue={toDateInputValue(new Date(), prefs.timeZone)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-note">Note</Label>
              <Input
                id="loan-note"
                name="note"
                placeholder="Optional — e.g. “wants it back by Christmas”"
                maxLength={500}
              />
            </div>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Lend out"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {past.length > 0 && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              Previously lent to
            </p>
            <ul className="grid gap-1 text-sm">
              {past.map((loan) => (
                <li
                  key={loan.id}
                  className="flex items-center justify-between gap-2 border-b py-1 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{loan.borrower}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {formatDate(loan.lentAt, prefs)} – {formatDate(loan.returnedAt, prefs)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete this record"
                    onClick={() => startTransition(() => deleteLoan(loan.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
