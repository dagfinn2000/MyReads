"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  cancelSmartShelfDraft,
  createSmartShelf,
  updateSmartShelfRules,
} from "@/lib/actions/smart-shelves";
import { fieldFilterLabel } from "@/lib/book-fields";
import { formatNumber } from "@/lib/display";
import { describeRules } from "@/lib/smart-shelves";
import { minRatingLabel } from "@/components/more-filters";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";

/**
 * Smart shelf rules in words (lib/smart-shelves.ts describeRules), worded
 * the reader's way: their status names, rating style, fields and numbers.
 * `shelves` names the reader's own shelves a rule can keep to; entries with
 * rules (smart shelves) are skipped.
 */
export function useDescribeRules(
  shelves: readonly { id: string; name: string; rules?: string }[],
): (rules: string) => string[] {
  const prefs = usePreferences();
  const shelfNames = useMemo(
    () => new Map(shelves.filter((s) => s.rules === undefined).map((s) => [s.id, s.name])),
    [shelves],
  );
  return useCallback(
    (rules: string) =>
      describeRules(rules, {
        statuses: prefs,
        shelfNames,
        ratingLabel: (v) => minRatingLabel(v, prefs.ratingStyle),
        fieldLabel: (f) => fieldFilterLabel(f, prefs.customFields, prefs),
        fmt: (n) => formatNumber(n, prefs),
      }),
    [prefs, shelfNames],
  );
}

/** Each rule as a small pill. */
export function RulePills({ rules }: { rules: string[] }) {
  return (
    <ul className="contents">
      {rules.map((rule, i) => (
        <li
          key={`${i}:${rule}`}
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80"
        >
          {rule}
        </li>
      ))}
    </ul>
  );
}

/**
 * The bar over the filters while a smart shelf's rules are being chosen
 * (lib/smart-shelf-draft.ts): which shelf, the rules the filters on
 * screen make, how many books they hold, and Save or Cancel. Saving opens
 * the shelf, with only its own chip to filter by.
 */
export function SmartShelfDraftBar({
  draft,
  rules,
  matching,
  shelves,
  view,
}: {
  draft: { id: string | null; name: string };
  /** The filters on screen as rules (smartRulesQuery). */
  rules: string;
  /** Books the filters on screen hold. */
  matching: number;
  /** Shelves of both kinds, for naming the one a rule keeps to. */
  shelves: readonly { id: string; name: string; rules?: string }[];
  /** The layout to open the shelf in: group, sort, dir. */
  view: Record<string, string>;
}) {
  const router = useRouter();
  const prefs = usePreferences();
  const describe = useDescribeRules(shelves);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const described = rules ? describe(rules) : [];
  const editing = draft.id !== null;

  const open = (shelfId: string | null) => {
    const params = new URLSearchParams(shelfId ? { shelfId } : {});
    for (const [k, v] of Object.entries(view)) params.set(k, v);
    router.push(`/books?${params}`);
  };

  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateSmartShelfRules(draft.id!, rules)
        : await createSmartShelf(draft.name, rules);
      if (res.error || !res.id) {
        setError(res.error ?? "Couldn't save that shelf.");
        return;
      }
      open(res.id);
    });
  }

  function cancel() {
    startTransition(async () => {
      await cancelSmartShelfDraft();
      if (editing) open(draft.id);
      else router.refresh();
    });
  }

  const books = `${formatNumber(matching, prefs)} book${matching === 1 ? "" : "s"}`;

  return (
    <section
      aria-label={editing ? `Rules of “${draft.name}”` : `New smart shelf “${draft.name}”`}
      data-smart-draft=""
      className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex min-w-0 items-center gap-2 font-medium">
          <Sparkles aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate">
            {editing ? `Changing the rules of “${draft.name}”` : `New smart shelf “${draft.name}”`}
          </span>
        </h2>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={pending || !rules}>
            {pending ? "Saving…" : editing ? "Save rules" : "Create shelf"}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Use the tabs, shelves and filters below. The books under them are the ones the shelf will
        hold, and books you add or change later join or leave it by themselves.
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
        {described.length > 0 ? (
          <>
            <span className="mr-0.5">Rules:</span>
            <RulePills rules={described} />
            <span className="ml-1 tabular-nums">· {books} match now</span>
          </>
        ) : (
          <span>No filters yet: pick a status tab, tags or More filters to start.</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
