"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { shakeNo } from "@/lib/motion";
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

/** Moves like the sign-in card: "Sign-in page motion" in globals.css. */
export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      setError("Passwords do not match");
      setBusy(false);
      shakeNo(card.current);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Registration failed");
      setBusy(false);
      shakeNo(card.current);
      return;
    }

    // Account created — sign straight in.
    await signIn("credentials", { username, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <Card ref={card} className="auth-card w-full max-w-sm">
      <CardHeader className="auth-row">
        <CardTitle>Create account</CardTitle>
        <CardDescription>Set up your library</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4" aria-busy={busy}>
          <div className="auth-row grid gap-2" style={{ "--i": 1 } as React.CSSProperties}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              autoFocus
              // Same limits as registerSchema, so a short name is caught
              // before the round trip.
              minLength={3}
              maxLength={32}
            />
          </div>
          <div className="auth-row grid gap-2" style={{ "--i": 2 } as React.CSSProperties}>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div className="auth-row grid gap-2" style={{ "--i": 3 } as React.CSSProperties}>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} />
          </div>
          {error && <p className="auth-error text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="auth-row"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            {busy ? "Creating…" : "Create account"}
          </Button>
          <p
            className="auth-row text-center text-sm text-muted-foreground"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            Already registered?{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
