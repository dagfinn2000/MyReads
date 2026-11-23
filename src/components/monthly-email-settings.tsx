"use client";

import { useState } from "react";
import { ExternalLink, MailCheck, Send } from "lucide-react";
import { sendMonthlyEmailNow } from "@/lib/actions/monthly-email";
import { EMAIL_ADDRESS_MAX, isEmailAddress } from "@/lib/email-address";
import { formatDayKey } from "@/lib/display";
import { monthName, monthTitle, previousMonth } from "@/lib/monthly-email";
import type { Preferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** What the Account page knows about the monthly email on this server. */
export interface MonthlyEmailInfo {
  /** Whether this server can send email (SMTP_HOST and friends). */
  available: boolean;
  /** The month the last one was about, "2026-10"; null before the first. */
  lastSent: string | null;
  /** When the next goes: the day (null: in the next few minutes) and the
   *  month it's about. */
  next: { day: string | null; month: string };
  /** The month just ended, the newest one there is to preview. */
  latest: string;
}

/**
 * Preferences › Monthly email, the address and the Preview and Send now
 * row. The switches themselves are ordinary toggles in the form.
 */
export function EmailAddressField({
  value,
  onSave,
}: {
  value: string;
  onSave: (address: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  function save() {
    const address = draft.trim();
    if (address && !isEmailAddress(address)) {
      setError("That doesn’t look like an email address.");
      return;
    }
    setError(null);
    setDraft(address);
    if (address !== value) onSave(address);
  }
  return (
    <div data-setting="Email address" className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div>
        <label htmlFor="email-address" className="text-sm font-medium">
          Email address
        </label>
        <p className="text-xs text-muted-foreground">Only ever used for this email.</p>
      </div>
      <div className="grid gap-1">
        <Input
          id="email-address"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          className="w-full sm:w-72"
          value={draft}
          placeholder="you@example.com"
          maxLength={EMAIL_ADDRESS_MAX}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-address-error" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        {error && (
          <p id="email-address-error" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** The last twelve months, newest first, for Preview and Send now. */
function recentMonths(latest: string): string[] {
  const months = [latest];
  while (months.length < 12) months.push(previousMonth(months[months.length - 1]));
  return months;
}

/** "Next one on 1 December, about November." and the like. */
export function monthlyEmailStatus(
  info: MonthlyEmailInfo,
  prefs: Pick<Preferences, "monthlyEmail" | "emailAddress" | "dateFormat">,
): string {
  if (!info.available) return "";
  if (!prefs.emailAddress) return "Add your address to turn it on.";
  if (!prefs.monthlyEmail) return "Off. Turn it on to get one on the 1st.";
  const about = monthName(info.next.month);
  return info.next.day
    ? `The next one comes on ${formatDayKey(info.next.day, prefs.dateFormat)}, about ${about}.`
    : `${about}’s is on its way within a quarter of an hour.`;
}

export function MonthlyEmailActions({
  info,
  address,
}: {
  info: MonthlyEmailInfo;
  /** The saved address; Send now needs one. */
  address: string;
}) {
  const months = recentMonths(info.latest);
  const [month, setMonth] = useState(info.latest);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  async function sendNow() {
    setBusy(true);
    setNote(null);
    try {
      const res = await sendMonthlyEmailNow(month);
      setNote(
        "error" in res
          ? { text: res.error, error: true }
          : { text: `Sent ${monthName(month)}’s to ${res.sentTo}. It should arrive in a minute or two.` },
      );
    } catch {
      setNote({ text: "Couldn’t send it. Try again in a moment.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-setting="See one" className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div>
        <p className="text-sm font-medium" id="monthly-email-try">
          See one
        </p>
        <p className="text-xs text-muted-foreground">
          {info.available
            ? "Look at a month’s email here, or send it to yourself now. Sending one now doesn’t count as that month’s."
            : "Look at what a month’s email would say."}
        </p>
      </div>
      <div className="grid gap-2">
        <div role="group" aria-labelledby="monthly-email-try" className="flex flex-wrap items-center gap-2">
          <Select lazyList value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-44" aria-label="Month">
              <SelectValue>{monthTitle(month)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthTitle(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/email/monthly?month=${month}`} target="_blank" rel="noopener">
              <ExternalLink data-slot="icon" />
              Preview
            </a>
          </Button>
          {info.available && (
            <Button
              type="button"
              size="sm"
              disabled={busy || !address}
              title={address ? `Send ${monthName(month)}’s email to ${address} now` : "Add your address first"}
              onClick={sendNow}
            >
              <Send data-slot="icon" />
              {busy ? "Sending…" : "Send it to me"}
            </Button>
          )}
        </div>
        {note && (
          <p
            aria-live="polite"
            className={note.error ? "text-sm text-destructive" : "flex items-center gap-1.5 text-sm text-muted-foreground"}
          >
            {!note.error && <MailCheck aria-hidden className="size-4 shrink-0 text-primary" />}
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
