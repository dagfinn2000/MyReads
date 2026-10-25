"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Send, Trash2 } from "lucide-react";
import {
  addPushDevice,
  reminderKey,
  removePushDevice,
  sendTestReminder,
} from "@/lib/actions/reminders";
import { formatDate } from "@/lib/display";
import type { Preferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";

export interface ReminderDevice {
  id: string;
  label: string;
  endpoint: string;
  /** ISO. */
  createdAt: string;
}

/** What this browser can do about reminders. */
type Support = "checking" | "ready" | "insecure" | "home-screen" | "unsupported" | "denied";

const SUPPORT_TEXT: Record<Exclude<Support, "checking" | "ready">, string> = {
  insecure:
    "Browsers only show notifications from a site opened over https (or on this computer, as localhost). Open MyReads at its https address to turn reminders on here.",
  "home-screen":
    "On an iPhone or iPad, reminders come to MyReads on the Home Screen. In Safari, tap Share › Add to Home Screen, open MyReads from there, and turn them on.",
  unsupported: "This browser can't show notifications from a website.",
  denied:
    "Notifications are blocked for this site. Allow them in the browser's settings for this site, then come back here.",
};

function detectSupport(): Support {
  if (!window.isSecureContext) return "insecure";
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !installed ? "home-screen" : "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "ready";
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/** This browser's reminders subscription, if it has one. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Preferences › Reading reminders, the browsers part: turning them on or
 * off in this one, and the list of every browser that has them on, each
 * with a test and a way to stop them there. A browser turns them on by
 * subscribing with its own push service (push-sw.js shows them).
 */
export function ReminderDevices({
  devices,
  prefs,
}: {
  devices: ReminderDevice[];
  prefs: Pick<Preferences, "dateFormat" | "timeZone">;
}) {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const found = detectSupport();
    const sub = found === "ready" ? currentSubscription().catch(() => null) : Promise.resolve(null);
    sub.then((s) => {
      if (!live) return;
      setEndpoint(s?.endpoint ?? null);
      setSupport(found);
    });
    return () => {
      live = false;
    };
  }, []);

  const here = devices.find((d) => d.endpoint === endpoint) ?? null;

  async function turnOn() {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setSupport("denied");
        else setNote({ text: "Notifications weren't allowed, so reminders can't show here.", error: true });
        return;
      }
      const res = await reminderKey();
      if ("error" in res) {
        setNote({ text: res.error, error: true });
        return;
      }
      const key = base64UrlToBytes(res.key);
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // Subscribed to another key (the server's was made again): start over.
      if (sub && !sameKey(sub.options.applicationServerKey, key)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await addPushDevice(sub.toJSON());
      if (saved.error) {
        setNote({ text: saved.error, error: true });
        return;
      }
      setEndpoint(sub.endpoint);
      setNote({ text: "Reminders are on in this browser." });
      router.refresh();
    } catch {
      setNote({ text: "This browser couldn't turn reminders on. Try again in a moment.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(device: ReminderDevice) {
    setBusy(true);
    setNote(null);
    try {
      await removePushDevice(device.id);
      if (device.endpoint === endpoint) {
        await (await currentSubscription())?.unsubscribe();
        setEndpoint(null);
      }
      router.refresh();
    } catch {
      setNote({ text: "Couldn't remove that. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function test(device: ReminderDevice) {
    setBusy(true);
    setNote(null);
    try {
      const res = await sendTestReminder(device.id);
      setNote(
        res.error
          ? { text: res.error, error: true }
          : { text: `Sent to ${device.label}. It should show in a moment.` },
      );
      if (res.error) router.refresh();
    } catch {
      setNote({ text: "Couldn't send that. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
        <BellRing
          aria-hidden
          className={here ? "size-4 shrink-0 text-primary" : "size-4 shrink-0 text-muted-foreground"}
        />
        <p className="min-w-0 flex-1 basis-56 text-sm">
          {support === "checking"
            ? "Looking at this browser…"
            : support !== "ready"
              ? SUPPORT_TEXT[support]
              : here
                ? "Reminders are on in this browser."
                : "Reminders are off in this browser."}
        </p>
        {support === "ready" &&
          (here ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(here)}>
              Turn off here
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={turnOn}>
              Turn on here
            </Button>
          ))}
      </div>

      {devices.length > 0 && (
        <ul className="grid gap-1" aria-label="Browsers with reminders on">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="min-w-0 flex-1 basis-48">
                {d.label}
                {d.endpoint === endpoint && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    This browser
                  </span>
                )}
                <span className="block text-xs text-muted-foreground">
                  Since {formatDate(new Date(d.createdAt), prefs)}
                </span>
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => test(d)}
                  title={`Send a reminder to ${d.label} now`}
                >
                  <Send data-slot="icon" />
                  Test
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => remove(d)}
                  title={`Stop reminders on ${d.label}`}
                  aria-label={`Stop reminders on ${d.label}`}
                >
                  <Trash2 data-slot="icon" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p aria-live="polite" className={note.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
