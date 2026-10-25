"use client";

import { useState } from "react";
import {
  FIELD_TEXT_MAX,
  fieldInputName,
  fieldInputValue,
  type BookField,
  type FieldValues,
} from "@/lib/book-fields";
import { usePreferences } from "@/components/preferences-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** A menu's "no value" item: Radix menus can't hold an empty value, and no
 *  option can be this (options are one line of text). */
const NONE = "\n";

/**
 * The reader's own fields in the add and edit forms (lib/book-fields.ts),
 * in their order. Each sends `field:<id>`; an empty one clears its value.
 * Nothing shows until the reader has added a field.
 */
export function BookFieldInputs({ values = {} }: { values?: FieldValues }) {
  const { customFields } = usePreferences();
  if (customFields.length === 0) return null;
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">Your fields</legend>
      {customFields.map((field) => (
        <FieldInput key={field.id} field={field} initial={fieldInputValue(values[field.id])} />
      ))}
    </fieldset>
  );
}

function FieldInput({ field, initial }: { field: BookField; initial: string }) {
  const id = `field-${field.id}`;
  const name = fieldInputName(field.id);
  return (
    <div className={field.type === "text" ? "grid gap-2 sm:col-span-2" : "grid gap-2"}>
      <Label htmlFor={id}>{field.name}</Label>
      {field.type === "choice" || field.type === "yesno" ? (
        <FieldMenu
          id={id}
          name={name}
          initial={initial}
          items={
            field.type === "yesno"
              ? [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]
              : field.options.map((o) => ({ value: o, label: o }))
          }
        />
      ) : (
        <Input
          id={id}
          name={name}
          defaultValue={initial}
          {...(field.type === "number" && { type: "number", step: "any", className: "w-40" })}
          {...(field.type === "date" && { type: "date", className: "w-40" })}
          {...(field.type === "text" && { maxLength: FIELD_TEXT_MAX })}
        />
      )}
    </div>
  );
}

/** A menu with a hidden input carrying its value, like the form's other
 *  menus (book-form.tsx says why). */
function FieldMenu({
  id,
  name,
  initial,
  items,
}: {
  id: string;
  name: string;
  initial: string;
  items: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(initial || NONE);
  return (
    <>
      <input type="hidden" name={name} value={value === NONE ? "" : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">Not set</span>
          </SelectItem>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
