"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ReadingStatus } from "@/lib/enums";
import { STATUS_LABELS } from "@/lib/display";
import type { Preferences } from "@/lib/preferences";
import {
  MAX_CUSTOM_STATUSES,
  STATUS_COLORS,
  STATUS_COLOR_DOT,
  STATUS_COLOR_LABELS,
  STATUS_NAME_MAX,
  cleanStatusName,
  statusName,
  type CustomStatus,
  type StatusColor,
} from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BASES = Object.values(ReadingStatus);

/** The colour a new status gets: the first of these no status of the
 *  reader's has, so it stands apart. Sky, amber and rose come last, being
 *  the built-in statuses' own tints. */
const NEW_COLORS: StatusColor[] = [
  "violet", "teal", "indigo", "pink", "orange", "lime", "slate", "sky", "amber", "rose",
];

/** A key no status of the reader's has yet. */
function freshKey(taken: CustomStatus[]): string {
  for (;;) {
    const key = Math.random().toString(36).slice(2, 8);
    if (key && !taken.some((c) => c.key === key)) return key;
  }
}

/** Why `name` can't be a status's name, or null when it can. Every status,
 *  built-in or the reader's own, needs a name of its own, or a status menu
 *  would offer two "Read"s. `except` is the status being renamed: a
 *  built-in one, or the key of one of the reader's. */
function nameError(name: string | null, prefs: Preferences, except?: string): string | null {
  if (!name) return `Give it a name of up to ${STATUS_NAME_MAX} characters.`;
  const taken = [
    ...BASES.filter((s) => s !== except).map((s) => statusName(s, prefs)),
    ...prefs.customStatuses.filter((c) => c.key !== except).map((c) => c.name),
  ].find((n) => n.toLowerCase() === name.toLowerCase());
  return taken ? `There is already a status called “${taken}”.` : null;
}

/**
 * Preferences › Reading statuses: new names for the four built-in statuses,
 * and statuses of the reader's own, each a kind of one of them
 * (lib/statuses.ts). Names save when the field is left, like a rename
 * anywhere else; the rest saves at once.
 */
export function StatusSettings({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const customs = prefs.customStatuses;
  const [newName, setNewName] = useState("");
  const [newBase, setNewBase] = useState<ReadingStatus>(ReadingStatus.READING);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  function rename(status: ReadingStatus, field: HTMLInputElement) {
    const name = cleanStatusName(field.value);
    const names = { ...prefs.statusNames };
    if (name && name !== STATUS_LABELS[status]) names[status] = name;
    else delete names[status];
    if ((prefs.statusNames[status] ?? "") === (names[status] ?? "")) return;
    // Left empty, it goes back to its own name, which has to be free too.
    const problem = nameError(names[status] ?? STATUS_LABELS[status], prefs, status);
    if (problem) {
      setError(problem);
      field.value = prefs.statusNames[status] ?? "";
      return;
    }
    setError(null);
    update({ statusNames: names });
  }

  function change(key: string, patch: Partial<CustomStatus>) {
    update({ customStatuses: customs.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = cleanStatusName(newName);
    const problem = nameError(name, prefs);
    if (problem) {
      setError(problem);
      return;
    }
    const used = new Set(customs.map((c) => c.color));
    const color = NEW_COLORS.find((c) => !used.has(c)) ?? "slate";
    update({ customStatuses: [...customs, { key: freshKey(customs), name: name!, base: newBase, color }] });
    setNewName("");
    setError(null);
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Rename the four statuses, or add your own: “Paused” as a kind of Currently Reading, say.
        Stats, goals and challenges count a book on one of your own as the status it is a kind of.
      </p>
      <div className="grid gap-2">
        {BASES.map((s) => (
          <div key={s} className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
            <label htmlFor={`status-name-${s}`} className="text-sm font-medium">
              {STATUS_LABELS[s]}
            </label>
            <Input
              // A fresh field whenever the saved name changes (a restore, say).
              key={prefs.statusNames[s] ?? ""}
              id={`status-name-${s}`}
              defaultValue={prefs.statusNames[s] ?? ""}
              placeholder={STATUS_LABELS[s]}
              maxLength={STATUS_NAME_MAX}
              onBlur={(e) => rename(s, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="w-full sm:w-72"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Your own statuses</p>
        {customs.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="grid gap-2">
            {customs.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2 text-sm">
                {removing === c.key ? (
                  <>
                    <span className="min-w-0">
                      Remove “{c.name}”? Its books stay {statusName(c.base, prefs)}.
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRemoving(null);
                          update({ customStatuses: customs.filter((x) => x.key !== c.key) });
                        }}
                      >
                        Remove
                      </Button>
                      <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  </>
                ) : (
                  <>
                    <Select value={c.color} onValueChange={(v) => change(c.key, { color: v as StatusColor })}>
                      <SelectTrigger className="w-28" aria-label={`Colour of “${c.name}”`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_COLORS.map((color) => (
                          <SelectItem key={color} value={color}>
                            <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_COLOR_DOT[color])} />
                            {STATUS_COLOR_LABELS[color]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      key={c.name}
                      defaultValue={c.name}
                      maxLength={STATUS_NAME_MAX}
                      aria-label={`Name of “${c.name}”`}
                      onBlur={(e) => {
                        const name = cleanStatusName(e.currentTarget.value);
                        if (name === c.name) return;
                        const problem = nameError(name, prefs, c.key);
                        if (problem) {
                          setError(problem);
                          e.currentTarget.value = c.name;
                          return;
                        }
                        setError(null);
                        change(c.key, { name: name! });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-8 min-w-0 flex-1 basis-40 sm:w-72 sm:flex-none"
                    />
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground sm:w-52 sm:flex-none">
                      a kind of {statusName(c.base, prefs)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={`Remove “${c.name}”`}
                      aria-label={`Remove “${c.name}”`}
                      onClick={() => setRemoving(c.key)}
                    >
                      <Trash2 data-slot="icon" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {customs.length < MAX_CUSTOM_STATUSES ? (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={STATUS_NAME_MAX}
              placeholder="New status"
              aria-label="New status"
              // As wide as a colour and a name above, so the menu lines up
              // with the "a kind of" beside them.
              className="h-8 min-w-0 flex-1 basis-40 sm:w-[25.5rem] sm:flex-none"
            />
            <Select value={newBase} onValueChange={(v) => setNewBase(v as ReadingStatus)}>
              <SelectTrigger className="w-60" aria-label="A kind of">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASES.map((s) => (
                  <SelectItem key={s} value={s}>
                    A kind of {statusName(s, prefs)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            That&apos;s the most there can be ({MAX_CUSTOM_STATUSES}).
          </p>
        )}
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    </>
  );
}
