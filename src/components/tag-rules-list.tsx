"use client";

import { useOptimistic, useState, useTransition } from "react";
import { X } from "lucide-react";
import { removeTagRule } from "@/lib/actions/tags";
import type { TagRename } from "@/lib/preferences";
import { Button } from "@/components/ui/button";

type Rules = { renames: TagRename[]; skips: string[] };
type Removal = { from?: string; skip?: string };

/**
 * The rules for imported subjects, under "Copy subjects from the catalogue
 * as tags" in Preferences. Rules are added from Manage tags in the library;
 * here they can only be removed. Each removal goes through its own action
 * (not the Preferences save, which would write back the whole list as this
 * page loaded it, dropping a rule added since in another tab).
 */
export function TagRulesList({ renames, skips }: Rules) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [rules, removeLocally] = useOptimistic<Rules, Removal>(
    { renames, skips },
    (current, gone) => ({
      renames: current.renames.filter((r) => r.from !== gone.from),
      skips: current.skips.filter((s) => s !== gone.skip),
    }),
  );

  function remove(rule: Removal) {
    setError(false);
    startTransition(async () => {
      removeLocally(rule);
      try {
        const res = await removeTagRule(rule);
        if (res.error) setError(true);
      } catch {
        setError(true);
      }
    });
  }

  const empty = rules.renames.length === 0 && rules.skips.length === 0;

  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div>
        <p className="text-sm font-medium">Tag rules</p>
        <p className="text-xs text-muted-foreground">For subjects copied from the catalogue.</p>
      </div>
      <div className="grid gap-1" aria-busy={pending}>
        {empty ? (
          <p className="text-sm text-muted-foreground">
            No tag rules yet. Renaming or removing a tag in Manage tags, in the library, can add one.
          </p>
        ) : (
          <ul className="grid gap-1">
            {rules.renames.map((r) => (
              <li key={`r-${r.from}`} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  {r.from} → {r.to}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove rule for “${r.from}”`}
                  title={`Remove rule for “${r.from}”`}
                  onClick={() => remove({ from: r.from })}
                >
                  <X data-slot="icon" />
                </Button>
              </li>
            ))}
            {rules.skips.map((tag) => (
              <li key={`s-${tag}`} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  {tag} <span className="text-muted-foreground">· never imported</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove rule for “${tag}”`}
                  title={`Remove rule for “${tag}”`}
                  onClick={() => remove({ skip: tag })}
                >
                  <X data-slot="icon" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t remove that rule. Try again.
          </p>
        )}
      </div>
    </div>
  );
}
