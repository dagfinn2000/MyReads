"use client";

import Link from "next/link";
import { CircleAlert, CloudOff, CloudUpload, X } from "lucide-react";
import { describeDay } from "@/lib/reading-log";
import { dayKey } from "@/lib/dates";
import { formatLength } from "@/lib/progress-units";
import { removeFromOutbox, savedWhen, type OutboxItem } from "@/lib/outbox";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { usePreferences } from "@/components/preferences-provider";
import { giveBackTime } from "@/components/reading-timer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The top bar's word on the connection, there only when it has something
 * to say: offline, reading saved on this device and waiting to be sent,
 * reading the server refused, or a page that's a saved copy. Tapped, it
 * says what that means and lists what's waiting.
 */
export function SyncStatus() {
  const offline = useOffline();
  const prefs = usePreferences();
  if (!offline) return null;
  const { online, items, state, savedAt } = offline;
  const refused = items.filter((i) => i.error);
  const waiting = items.filter((i) => !i.error);
  const unreachable = online && state === "unreachable";
  if (refused.length === 0 && waiting.length === 0 && online && !unreachable && savedAt === null) {
    return null;
  }

  const now = new Date();
  const [Icon, label] =
    refused.length > 0
      ? [CircleAlert, `${refused.length} not saved`]
      : !online
        ? [CloudOff, "Offline"]
        : waiting.length > 0
          ? [CloudUpload, state === "sending" ? "Sending…" : `${waiting.length} to send`]
          : unreachable
            ? [CloudOff, "Can't reach MyReads"]
            : [CloudOff, "Saved copy"];
  const count = refused.length || waiting.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title={label}
          className={cn("sync-status relative", refused.length > 0 && "text-destructive hover:text-destructive")}
        >
          <Icon data-slot="icon" />
          <span className="hidden sm:inline">{label}</span>
          {/* A phone shows the icon alone, with the count on it. */}
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-0 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] leading-none font-semibold text-primary-foreground tabular-nums sm:hidden"
            >
              {count}
            </span>
          )}
          <span className="sr-only sm:hidden">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3 text-sm">
        <div className="grid gap-1">
          <p className="font-medium">
            {!online
              ? "You're offline."
              : unreachable
                ? "MyReads can't be reached right now."
                : state === "signed-out"
                  ? "Sign in again to send what's saved here."
                  : waiting.length > 0
                    ? "Back online."
                    : refused.length > 0
                      ? "Some reading couldn't be saved."
                      : "You're looking at a saved copy."}
          </p>
          <p className="text-muted-foreground">
            {savedAt !== null && `This page was saved ${savedWhen(savedAt, now, prefs.timeZone, prefs.dateFormat)}. `}
            {!online || unreachable
              ? "Pages you've opened lately still open, and reading you log is saved on this device. It's sent once MyReads can be reached."
              : waiting.length > 0
                ? "What you logged on this device is on its way."
                : refused.length > 0
                  ? "The server turned these down. The book may have changed on another device."
                  : "It updates when MyReads can be reached."}
          </p>
        </div>
        {waiting.length > 0 && (
          <ItemList title="Waiting to be sent" items={waiting} />
        )}
        {refused.length > 0 && <ItemList title="Not saved" items={refused} />}
        <div className="flex flex-wrap gap-2">
          {state === "signed-out" && (
            <Button asChild size="sm">
              {/* A full load: the sign-in page isn't part of this app. */}
              <a href="/login">Sign in</a>
            </Button>
          )}
          {waiting.length > 0 && online && state !== "signed-out" && (
            <Button size="sm" variant="outline" disabled={state === "sending"} onClick={offline.sendNow}>
              {state === "sending" ? "Sending…" : "Send now"}
            </Button>
          )}
          {online && savedAt !== null && waiting.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => location.reload()}>
              Reload
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ItemList({ title, items }: { title: string; items: OutboxItem[] }) {
  const prefs = usePreferences();
  const today = dayKey(new Date(), prefs.timeZone);
  return (
    <section className="grid gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
        {items.map((item) => {
          const what =
            item.kind === "log"
              ? `${item.label} for ${describeDay(item.day, today, prefs.dateFormat)}`
              : item.label;
          return (
            <li key={item.id} className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <Link href={`/books/${item.bookId}`} className="font-medium hover:underline">
                  {item.title}
                </Link>
                <span className="text-muted-foreground">
                  {" · "}
                  {what}
                  {item.minutes ? ` · ${formatLength(item.minutes)}` : ""}
                </span>
                {item.error && <span className="block text-xs text-destructive">{item.error}</span>}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${item.title}, ${what}`}
                title="Remove"
                onClick={() => {
                  const removed = removeFromOutbox(item.id);
                  if (removed?.minutes && !removed.error) giveBackTime(removed.bookId, removed.minutes);
                }}
              >
                <X />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
