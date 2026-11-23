"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addPasskey,
  passkeyRegistrationOptions,
  removePasskey,
  renamePasskey,
  signOutEverywhereElse,
} from "@/lib/actions/passkeys";
import { createPasskey, passkeyErrorText, usePasskeySupport } from "@/lib/passkey-client";
import { formatDate } from "@/lib/display";
import type { Preferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PasskeyRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const UNAVAILABLE_TEXT = {
  insecure:
    "Passkeys need MyReads to be opened over https (or on localhost), so they can’t be added at this address.",
  unsupported: "This browser can’t make passkeys.",
} as const;

type Note = { text: string; error?: boolean } | null;

/**
 * Account › Signing in › Passkeys: the account's passkeys, with a button
 * to add one on this device or in a password manager, and each one
 * renamable and removable. Checking them is lib/webauthn.ts.
 */
export function PasskeySettings({ passkeys, prefs }: { passkeys: PasskeyRow[]; prefs: Preferences }) {
  const router = useRouter();
  const unavailable = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setAdding(true);
    setNote(null);
    try {
      const res = await passkeyRegistrationOptions();
      if ("error" in res) {
        setNote({ text: res.error ?? "", error: true });
        return;
      }
      const made = await createPasskey(res.options);
      if (!made) return;
      const saved = await addPasskey(made);
      if (saved.error) setNote({ text: saved.error, error: true });
      else {
        setNote({ text: `Added “${saved.name}”. You can sign in with it now.` });
        router.refresh();
      }
    } catch (e) {
      const text = passkeyErrorText(e);
      if (text) setNote({ text, error: true });
    } finally {
      setBusy(false);
      setAdding(false);
    }
  }

  async function saveName(id: string) {
    setBusy(true);
    const res = await renamePasskey(id, draft);
    setBusy(false);
    if (res.error) {
      setNote({ text: res.error, error: true });
      return;
    }
    setEditing(null);
    setNote(null);
    router.refresh();
  }

  async function remove(p: PasskeyRow) {
    setBusy(true);
    await removePasskey(p.id);
    setBusy(false);
    setRemoving(null);
    setNote({ text: `Removed “${p.name}”. You can delete it from that device or password manager too.` });
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Sign in with your fingerprint, face or screen lock instead of your password. A passkey lives on your
        device or in your password manager, and only works on this site.
      </p>

      {passkeys.length > 0 && (
        <ul className="grid gap-2" aria-label="Your passkeys">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2">
              <KeyRound aria-hidden className="size-4 shrink-0 text-primary" />
              {editing === p.id ? (
                <form
                  className="flex min-w-0 flex-1 basis-56 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveName(p.id);
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={60}
                    aria-label="Passkey name"
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <Button type="submit" size="icon-sm" variant="ghost" disabled={busy} aria-label="Save name">
                    <Check data-slot="icon" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                    aria-label="Keep the old name"
                  >
                    <X data-slot="icon" />
                  </Button>
                </form>
              ) : (
                <span className="min-w-0 flex-1 basis-56 text-sm">
                  <span className="font-medium break-words">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Added {formatDate(new Date(p.createdAt), prefs)}
                    {" · "}
                    {p.lastUsedAt ? `last used ${formatDate(new Date(p.lastUsedAt), prefs)}` : "not used yet"}
                  </span>
                </span>
              )}
              {editing !== p.id &&
                (removing === p.id ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-sm text-muted-foreground">Remove it?</span>
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove(p)}>
                      Remove
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditing(p.id);
                        setDraft(p.name);
                        setRemoving(null);
                      }}
                      title={`Rename ${p.name}`}
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil data-slot="icon" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRemoving(p.id)}
                      title={`Remove ${p.name}`}
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 data-slot="icon" />
                    </Button>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}

      {unavailable && unavailable !== "checking" ? (
        <p className="text-sm text-muted-foreground">{UNAVAILABLE_TEXT[unavailable]}</p>
      ) : (
        <div>
          <Button type="button" variant="outline" disabled={busy || unavailable === "checking"} onClick={add}>
            <Plus data-slot="icon" />
            {adding ? "Waiting for the passkey…" : "Add a passkey"}
          </Button>
        </div>
      )}

      {note && (
        <p aria-live="polite" className={note.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/**
 * Account › Signing in › Other devices: signs out every other browser and
 * phone signed in to the account, keeping this one.
 */
export function SignOutEverywhereElse() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await signOutEverywhereElse();
      setDone(true);
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Left yourself signed in on a shared computer, or lost a phone? This signs out everywhere you’re signed in,
        except here.
      </p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Sign out every other browser and phone?</span>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={go}>
            {busy ? "Signing out…" : "Sign them out"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirming(true);
              setDone(false);
            }}
          >
            <LogOut data-slot="icon" />
            Sign out everywhere else
          </Button>
        </div>
      )}
      {done && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Done. Everywhere else is signed out; this browser is still signed in.
        </p>
      )}
    </div>
  );
}
