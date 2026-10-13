"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
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
 *  — say so, otherwise being bounced here looks like a bug. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justChangedPassword = searchParams.get("changed") === "1";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Personal self-hosted library and reading tracker</CardDescription>
      </CardHeader>
      <CardContent>
        {justChangedPassword && (
          <p className="mb-4 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            Password changed. Sign in again — this also signed you out
            anywhere else you were logged in.
          </p>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" autoComplete="username" required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
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
