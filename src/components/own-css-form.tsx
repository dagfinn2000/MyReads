"use client";

import { useState } from "react";
import { OWN_CSS_MAX } from "@/lib/own-css";
import { formatNumber } from "@/lib/display";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE = `[data-section="stats"] h1 {
  letter-spacing: 0.04em;
}`;

/**
 * Preferences > Your own CSS. Saved with a button rather than as it's
 * typed: half a rule would be applied on every other page.
 */
export function OwnCssForm({
  value,
  onSave,
}: {
  value: string;
  onSave: (css: string) => void;
}) {
  const prefs = usePreferences();
  const [draft, setDraft] = useState(value);
  const changed = draft !== value;

  return (
    <div className="grid gap-2">
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>
          Added after the app’s own styles on every page but this one, so a mistake can always
          be put right here. To see any page without it, add <code>?css=off</code> to its address.
        </p>
        <p>
          Each page names its part on the <code>html</code> element as <code>data-section</code>:
          library, book, series, stats, reading, quotes, room or account. So{" "}
          <code>[data-section=&quot;stats&quot;] h1 &#123; … &#125;</code> styles only the
          Stats page’s titles.
        </p>
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={OWN_CSS_MAX}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={EXAMPLE}
        aria-label="Your own CSS"
        className="max-h-[28rem] min-h-36 font-mono text-xs md:text-xs"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNumber(draft.length, prefs)} of {formatNumber(OWN_CSS_MAX, prefs)} characters
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!changed} onClick={() => setDraft(value)}>
            Undo changes
          </Button>
          <Button size="sm" disabled={!changed} onClick={() => onSave(draft)}>
            Save CSS
          </Button>
        </div>
      </div>
    </div>
  );
}
