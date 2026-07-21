"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { deleteAccount } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Two-step account deletion: the first click only reveals a password
 * prompt, so the destructive action always takes a deliberate second step.
 * On success the server action signs out and redirects — nothing to render
 * after that.
 */
export function DeleteAccount({ bookCount }: { bookCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, {});

  if (!confirming) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          Delete account…
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid max-w-sm gap-4">
      <p className="flex items-start gap-2 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          This permanently deletes your account and all {bookCount} book
          {bookCount === 1 ? "" : "s"} — reading history, quotes, shelves,
          goals, covers, everything. There is no undo. Consider downloading a
          backup first.
        </span>
      </p>
      <div className="grid gap-2">
        <Label htmlFor="delete-password">Your password</Label>
        <Input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
