"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { shakeNo } from "@/lib/motion";
import { passkeySignInOptions } from "@/lib/actions/passkeys";
import { getPasskey, passkeyAutofill, passkeyErrorText, usePasskeySupport } from "@/lib/passkey-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Changing your password invalidates every session, including this browser's
 *  — say so, otherwise being bounced here looks like a bug.
 *
 *  The card and its rows rise in as the page opens, the shelf above bobs
 *  while it signs in (aria-busy) and the card shakes at a wrong password:
 *  "Sign-in page motion" in globals.css. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justChangedPassword = searchParams.get("changed") === "1";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canPasskey = usePasskeySupport() === null;
  const card = useRef<HTMLDivElement>(null);
  // The passkey offered in the username box's suggestions, waiting.
  const autofill = useRef<{ stop: AbortController; done: Promise<unknown> } | null>(null);

  const failed = useCallback((text: string) => {
    setError(text);
    setBusy(false);
    shakeNo(card.current);
  }, []);

  /** Signs in with a passkey's answer (from either way of asking). */
  const finishPasskey = useCallback(
    async (response: string) => {
      setBusy(true);
      setError(null);
      const res = await signIn("passkey", { response, redirect: false });
      if (res?.error) {
        failed(
          res.code === "rate-limited"
            ? "Too many failed attempts — wait a few minutes and try again."
            : "That passkey didn’t sign you in. It may have been removed from your account.",
        );
      } else {
        router.push("/");
        router.refresh();
      }
    },
    [failed, router],
  );

  // Passkeys show up among the username box's suggestions where the
  // browser can do that; picking one signs in.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await passkeyAutofill()) || cancelled) return;
      const asked = await passkeySignInOptions().catch(() => null);
      if (!asked || "error" in asked || cancelled) return;
      const stop = new AbortController();
      const done = getPasskey(asked.options, { signal: stop.signal, autofill: true }).then(
        (response) => {
          if (response) void finishPasskey(response);
        },
        () => undefined, // stopped, or the reader went another way
      );
      autofill.current = { stop, done };
    })();
    return () => {
      cancelled = true;
      autofill.current?.stop.abort();
    };
  }, [finishPasskey]);

  async function signInWithPasskey() {
    setError(null);
    // A browser asks for one passkey at a time: stop the waiting one first.
    if (autofill.current) {
      autofill.current.stop.abort();
      await autofill.current.done;
      autofill.current = null;
    }
    setBusy(true);
    try {
      const asked = await passkeySignInOptions();
      if ("error" in asked) {
        failed(asked.error ?? "");
        return;
      }
      const response = await getPasskey(asked.options);
      if (response) await finishPasskey(response);
      else setBusy(false);
    } catch (e) {
      const text = passkeyErrorText(e);
      if (text) failed(text);
      else setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });

    if (res?.error) {
      setError(
        res.code === "rate-limited"
          ? "Too many failed attempts — wait a few minutes and try again."
          : "Invalid username or password",
      );
      setBusy(false);
      shakeNo(card.current);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card ref={card} className="auth-card w-full max-w-sm">
      <CardHeader className="auth-row">
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Personal self-hosted library and reading tracker</CardDescription>
      </CardHeader>
      <CardContent>
        {justChangedPassword && (
          <p
            className="auth-row mb-4 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Password changed. Sign in again — this also signed you out
            anywhere else you were logged in.
          </p>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4" aria-busy={busy}>
          <div className="auth-row grid gap-2" style={{ "--i": 2 } as React.CSSProperties}>
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" autoComplete="username webauthn" required autoFocus />
          </div>
          <div className="auth-row grid gap-2" style={{ "--i": 3 } as React.CSSProperties}>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="auth-error text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="auth-row"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          {canPasskey && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={signInWithPasskey}
              className="auth-row"
              style={{ "--i": 5 } as React.CSSProperties}
            >
              <KeyRound data-slot="icon" />
              Sign in with a passkey
            </Button>
          )}
          <p
            className="auth-row text-center text-sm text-muted-foreground"
            style={{ "--i": 6 } as React.CSSProperties}
          >
            No account?{" "}
            <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
              Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
