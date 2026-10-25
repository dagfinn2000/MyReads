"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  FIELD_NAME_MAX,
  FIELD_OPTION_MAX,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  MAX_BOOK_FIELDS,
  MAX_FIELD_OPTIONS,
  cleanLine,
  type BookField,
  type FieldType,
} from "@/lib/book-fields";
import type { Preferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** An id no field of the reader's has yet. */
function freshId(taken: BookField[]): string {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8);
    if (id && !taken.some((f) => f.id === id)) return id;
  }
}

/** Why `name` can't name a field, or null when it can. `except` is the
 *  field being renamed. */
function nameError(name: string | null, fields: BookField[], except?: string): string | null {
  if (!name) return `Give it a name of up to ${FIELD_NAME_MAX} characters.`;
  if (fields.some((f) => f.id !== except && f.name.toLowerCase() === name.toLowerCase())) {
    return `There is already a field called “${name}”.`;
  }
  return null;
}

/** Enter in a box commits it the way leaving it does. */
function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

/**
 * Preferences › Book fields: fields of the reader's own on every book
 * (lib/book-fields.ts), each a name and a type, a choice with its options.
 * Names save when the box is left; the rest at once. Removing a field, or
 * an option, asks first, since the books' values for it go too.
 */
export function FieldSettings({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const fields = prefs.customFields;
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  function change(id: string, patch: Partial<BookField>) {
    update({ customFields: fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = cleanLine(newName, FIELD_NAME_MAX);
    const problem = nameError(name, fields);
    if (problem) {
      setError(problem);
      return;
    }
    update({ customFields: [...fields, { id: freshId(fields), name: name!, type: newType, options: [] }] });
    setNewName("");
    setError(null);
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Fields of your own for every book: where it&apos;s shelved, what it cost, whether it&apos;s
        signed. Fill them in when you add or edit a book. They show on the book&apos;s page, and
        the library can search them and filter by them under More filters.
      </p>
      <div className="grid gap-3">
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="grid gap-3">
            {fields.map((f) => (
              <li key={f.id} className="grid gap-2 text-sm">
                {removing === f.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0">
                      Remove “{f.name}”? Every book&apos;s {f.type === "yesno" ? "answer" : "value"} for it
                      goes too.
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRemoving(null);
                          update({ customFields: fields.filter((x) => x.id !== f.id) });
                        }}
                      >
                        Remove
                      </Button>
                      <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      key={f.name}
                      defaultValue={f.name}
                      maxLength={FIELD_NAME_MAX}
                      aria-label={`Name of “${f.name}”`}
                      onBlur={(e) => {
                        const name = cleanLine(e.currentTarget.value, FIELD_NAME_MAX);
                        if (name === f.name) return;
                        const problem = nameError(name, fields, f.id);
                        if (problem) {
                          setError(problem);
                          e.currentTarget.value = f.name;
                          return;
                        }
                        setError(null);
                        change(f.id, { name: name! });
                      }}
                      onKeyDown={blurOnEnter}
                      className="h-8 min-w-0 flex-1 basis-40 sm:w-72 sm:flex-none"
                    />
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground sm:w-28 sm:flex-none">
                      {FIELD_TYPE_LABELS[f.type]}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={`Remove “${f.name}”`}
                      aria-label={`Remove “${f.name}”`}
                      onClick={() => setRemoving(f.id)}
                    >
                      <Trash2 data-slot="icon" />
                    </Button>
                  </div>
                )}
                {f.type === "choice" && removing !== f.id && (
                  <ChoiceOptions field={f} onChange={(options) => change(f.id, { options })} />
                )}
              </li>
            ))}
          </ul>
        )}
        {fields.length < MAX_BOOK_FIELDS ? (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={FIELD_NAME_MAX}
              placeholder="New field"
              aria-label="New field"
              className="h-8 min-w-0 flex-1 basis-40 sm:w-72 sm:flex-none"
            />
            <Select value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
              <SelectTrigger className="w-36" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
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
            That&apos;s the most there can be ({MAX_BOOK_FIELDS}).
          </p>
        )}
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    </>
  );
}

/** A choice field's options as chips, each with a remove button that asks
 *  first, and a box to add another. */
function ChoiceOptions({
  field,
  onChange,
}: {
  field: BookField;
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    const option = cleanLine(draft, FIELD_OPTION_MAX);
    if (!option) return;
    if (field.options.some((o) => o.toLowerCase() === option.toLowerCase())) {
      setError(`“${option}” is already there.`);
      return;
    }
    onChange([...field.options, option]);
    setDraft("");
    setError(null);
  }

  return (
    <div className="grid gap-1.5 border-l pl-3 sm:ml-1">
      {removing !== null ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Take “{removing}” off? The books that have it lose it.</span>
          <span className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                onChange(field.options.filter((o) => o !== removing));
                setRemoving(null);
              }}
            >
              Take it off
            </Button>
            <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setRemoving(null)}>
              Keep
            </Button>
          </span>
        </div>
      ) : (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label={`Options of “${field.name}”`}>
          {field.options.map((o) => (
            <li
              key={o}
              className="inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs"
            >
              {o}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Take “${o}” off`}
                title={`Take “${o}” off`}
                onClick={() => setRemoving(o)}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
          {field.options.length < MAX_FIELD_OPTIONS && (
            <li className="inline-flex items-center gap-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                maxLength={FIELD_OPTION_MAX}
                placeholder={field.options.length === 0 ? "Its first option" : "Another option"}
                aria-label={`New option for “${field.name}”`}
                className="h-7 w-40 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add the option"
                title="Add the option"
                onClick={add}
              >
                <Plus data-slot="icon" />
              </Button>
            </li>
          )}
        </ul>
      )}
      {error && (
        <p aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
