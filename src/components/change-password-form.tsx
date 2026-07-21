"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Change-password form on the account page. The confirm field is checked
 *  here (it only guards against typos); everything real — current-password
 *  verification, new-password rules — happens in the server action. */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      if (formData.get("newPassword") !== formData.get("confirm")) {
        return { error: "New passwords do not match" };
      }
      return changePassword(prev, formData);
    },
    {},
  );

  return (
    <form action={formAction} className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-muted-foreground">Password changed.</p>
      )}
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
