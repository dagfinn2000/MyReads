"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { savePreferences } from "@/lib/actions/preferences";
import { deleteView, renameView } from "@/lib/actions/saved-views";
import { moveId, orderByIds } from "@/lib/library-order";
import { SAVED_VIEW_NAME_MAX } from "@/lib/saved-views";
import {
  FORMAT_LABELS,
  OWNERSHIP_LABELS,
  STATUS_LABELS,
  formatDayKey,
  formatNumber,
} from "@/lib/display";
import {
  ACCENTS,
  BACKGROUNDS,
  CATALOGUES,
  DATE_FORMATS,
  HIDEABLE_NAV,
  HIDEABLE_STATS,
  NUMBER_FORMATS,
  type Accent,
  type Background,
  type Catalogue,
  type HideableNav,
  type HideableStat,
  type Preferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATALOGUE_LABELS: Record<Catalogue, string> = {
  openlibrary: "Open Library",
  google: "Google Books",
  nb: "National Library of Norway",
};

const NAV_LABELS: Record<HideableNav, string> = {
  reading: "Now reading",
  check: "Check (“Do I own this?”)",
  quotes: "Quotes",
};

const ACCENT_LABELS: Record<Accent, string> = {
  theme: "Theme default",
  rose: "Rose",
  orange: "Orange",
  amber: "Amber",
  emerald: "Emerald",
  teal: "Teal",
  sky: "Sky",
  indigo: "Indigo",
  violet: "Violet",
  fuchsia: "Fuchsia",
};

/**
 * Appearance settings that the root layout puts on <html> as data
 * attributes, keyed by preference. The form sets the attribute straight
 * away as well as saving, so a change shows at once instead of after the
 * server round trip; the refreshed layout then writes the same value.
 */
const HTML_ATTRIBUTES: Partial<Record<keyof Preferences, string>> = {
  headingFont: "data-heading-font",
  motion: "data-motion",
  coverArt: "data-covers",
  accent: "data-accent",
  corners: "data-corners",
  background: "data-background",
};

/** The accent colour swatches, one round button each. */
function AccentPicker({ value, onChange }: { value: Accent; onChange: (a: Accent) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">Accent colour</p>
        <p className="text-xs text-muted-foreground">Buttons, links, progress bars and focus rings.</p>
      </div>
      <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap items-center gap-1.5">
        {ACCENTS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            aria-label={ACCENT_LABELS[a]}
            title={ACCENT_LABELS[a]}
            onClick={() => onChange(a)}
            className={cn(
              "h-7 rounded-full border-2 border-background ring-1 ring-border transition-shadow",
              a === "theme" ? "bg-muted px-2.5 text-xs" : "w-7",
              value === a && "ring-2 ring-foreground",
            )}
            // The swatch shows the shade this mode would use (globals.css).
            style={a === "theme" ? undefined : { background: `var(--accent-${a})` }}
          >
            {a === "theme" ? "Theme" : null}
          </button>
        ))}
      </div>
    </div>
  );
}

const BACKGROUND_LABELS: Record<Background, string> = {
  plain: "Plain",
  grain: "Paper grain",
  dots: "Dots",
  lines: "Ruled lines",
  grid: "Graph paper",
  linen: "Linen",
  books: "Little books",
  waves: "Waves",
  glow: "Glow",
};

/** The background textures as small previews of the page, one button
 *  each. A swatch is drawn by the same CSS as the page (globals.css). */
function BackgroundPicker({
  value,
  onChange,
}: {
  value: Background;
  onChange: (b: Background) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div>
        <p className="text-sm font-medium">Background</p>
        <p className="text-xs text-muted-foreground">Behind the pages, not the cards on them.</p>
      </div>
      <div role="radiogroup" aria-label="Background" className="flex flex-wrap gap-2">
        {BACKGROUNDS.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={value === b}
            onClick={() => onChange(b)}
            className="group grid w-16 justify-items-center gap-1 text-[11px] text-muted-foreground"
          >
            <span
              className={cn(
                "texture-swatch h-11 w-16 rounded-md border ring-offset-2 ring-offset-background transition-shadow group-hover:border-ring/60",
                value === b && "ring-2 ring-foreground",
              )}
              data-texture={b}
              aria-hidden="true"
            />
            <span className={cn("leading-tight", value === b && "font-medium text-foreground")}>
              {BACKGROUND_LABELS[b]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const STATS_LABELS: Record<HideableStat, string> = {
  goal: "Reading goal",
  heatmap: "Reading days calendar",
  perYear: "Books read per year",
  tags: "Genres & tags",
  formats: "Formats",
  quote: "From your quotes",
};

/** A labelled dropdown row. */
function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full sm:w-72" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A checkbox with its label. */
function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  /** For links straight to the section (/account#pick-for-me). */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The Preferences card on the Account page. Every change saves straight
 * away (only the setting that changed is sent) and the page refreshes, so
 * the rest of the app picks it up on the next screen.
 */
export function PreferencesForm({
  initial,
  serverTimeZone,
  timeZones,
  googleAvailable,
  savedViews,
}: {
  /** As stored: `timeZone` is "" while the server's zone is in use. */
  initial: Preferences;
  serverTimeZone: string;
  /** Every zone this server knows, for the time zone list. */
  timeZones: string[];
  /** Whether this server has a Google Books key. Without one the catalogue
   *  isn't searched whatever the setting says, so it isn't offered. */
  googleAvailable: boolean;
  savedViews: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  function update(patch: Partial<Preferences>) {
    setPrefs((p) => ({ ...p, ...patch }));
    for (const [key, value] of Object.entries(patch)) {
      const attribute = HTML_ATTRIBUTES[key as keyof Preferences];
      if (attribute) document.documentElement.setAttribute(attribute, String(value));
    }
    setStatus("saving");
    startTransition(async () => {
      try {
        await savePreferences(patch);
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  function toggleIn<T extends string>(list: T[], item: T, on: boolean): T[] {
    return on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item);
  }

  // Catalogues: the enabled ones in priority order, then the rest.
  const offered = CATALOGUES.filter((c) => c !== "google" || googleAvailable);
  const enabled = prefs.catalogues.filter((c) => offered.includes(c));
  const catalogueRows = [...enabled, ...offered.filter((c) => !enabled.includes(c))];

  function moveCatalogue(c: Catalogue, by: -1 | 1) {
    const list = [...enabled];
    const i = list.indexOf(c);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // Keep an unavailable Google Books in the list (last), so it comes back
    // on if this server gets a key later.
    update({ catalogues: [...list, ...prefs.catalogues.filter((x) => !offered.includes(x))] });
  }

  const zone = prefs.timeZone || serverTimeZone;
  const zoneOptions = timeZones.includes(zone) ? timeZones : [zone, ...timeZones];

  // Saved views in the reader's order, which moving one changes at once.
  const views = orderByIds(savedViews, prefs.savedViewOrder);
  const shownStatusTabs = Object.values(ReadingStatus).filter(
    (s) => !prefs.hiddenStatusTabs.includes(s),
  ).length;

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved."
            : status === "error"
              ? "Couldn't save that change. Try again."
              : "Changes save as you make them."}
      </p>

      <Section title="New books">
        <Choice
          label="Format"
          value={prefs.newBookFormat}
          options={Object.values(BookFormat).map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
          onChange={(v) => update({ newBookFormat: v })}
        />
        <Choice
          label="Status"
          value={prefs.newBookStatus}
          options={Object.values(ReadingStatus).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(v) => update({ newBookStatus: v })}
        />
        <Choice
          label="Ownership"
          value={prefs.newBookOwnership}
          options={Object.values(BookOwnership).map((o) => ({
            value: o,
            label: OWNERSHIP_LABELS[o],
          }))}
          onChange={(v) => update({ newBookOwnership: v })}
        />
        <Toggle
          label="Copy subjects from the catalogue as tags"
          checked={prefs.importTagsMode !== "off"}
          onChange={(c) => update({ importTagsMode: c ? "all" : "off" })}
        />
      </Section>

      <Section title="Dates and numbers">
        <Choice
          label="Dates"
          value={prefs.dateFormat}
          options={DATE_FORMATS.map((f) => ({ value: f, label: formatDayKey("2024-05-12", f) }))}
          onChange={(v) => update({ dateFormat: v })}
        />
        <Choice
          label="Numbers"
          value={prefs.numberFormat}
          options={NUMBER_FORMATS.map((f) => ({
            value: f,
            label: formatNumber(12345, { numberFormat: f }),
          }))}
          onChange={(v) => update({ numberFormat: v })}
        />
        <Choice
          label="Weeks start on"
          value={prefs.weekStart}
          options={[
            { value: "monday", label: "Monday" },
            { value: "sunday", label: "Sunday" },
          ]}
          onChange={(v) => update({ weekStart: v })}
        />
        <Choice
          label="Time zone"
          hint="Decides which day your reading counts on."
          value={zone}
          options={zoneOptions.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
          onChange={(v) => update({ timeZone: v })}
        />
      </Section>

      <Section title="Sorting">
        <Toggle
          label="Ignore “The”, “A” and “An” when sorting titles"
          checked={prefs.ignoreArticles}
          onChange={(c) => update({ ignoreArticles: c })}
        />
        <Choice
          label="Authors"
          value={prefs.authorOrder}
          options={[
            { value: "surname", label: "By surname (Le Guin under L)" },
            { value: "as-written", label: "As written (Ursula under U)" },
          ]}
          onChange={(v) => update({ authorOrder: v })}
        />
        <Choice
          label="Alphabet"
          hint="Where letters like Æ, Ø, Å and Ö sort."
          value={prefs.sortAlphabet}
          options={[
            { value: "en", label: "English" },
            { value: "nb", label: "Norwegian (Æ, Ø, Å after Z)" },
            { value: "da", label: "Danish (Æ, Ø, Å after Z)" },
            { value: "sv", label: "Swedish (Å, Ä, Ö after Z)" },
            { value: "de", label: "German (Ä with A, Ö with O)" },
          ]}
          onChange={(v) => update({ sortAlphabet: v })}
        />
      </Section>

      <Section title="Library" id="library">
        <div className="grid gap-1.5">
          <div>
            <p className="text-sm font-medium">Status tabs to show</p>
            <p className="text-xs text-muted-foreground">The All tab always shows.</p>
          </div>
          {Object.values(ReadingStatus).map((s) => {
            const shown = !prefs.hiddenStatusTabs.includes(s);
            return (
              <Toggle
                key={s}
                label={STATUS_LABELS[s]}
                checked={shown}
                // At least one status tab stays.
                disabled={shown && shownStatusTabs === 1}
                onChange={(on) =>
                  update({ hiddenStatusTabs: toggleIn(prefs.hiddenStatusTabs, s, !on) })
                }
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Order and hide shelf chips from Manage shelves in the library.
        </p>
      </Section>

      <Section title="Book search">
        <p className="text-xs text-muted-foreground">
          Which catalogues to search when adding a book, and which comes first.
        </p>
        <ul className="grid gap-1.5">
          {catalogueRows.map((c) => {
            const on = enabled.includes(c);
            const i = enabled.indexOf(c);
            return (
              <li key={c} className="flex items-center gap-2">
                <Toggle
                  label={CATALOGUE_LABELS[c]}
                  checked={on}
                  // At least one catalogue stays on.
                  disabled={on && enabled.length === 1}
                  onChange={(checked) =>
                    update({
                      catalogues: checked
                        ? [...prefs.catalogues, c]
                        : prefs.catalogues.filter((x) => x !== c),
                    })
                  }
                />
                {on && enabled.length > 1 && (
                  <span className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Search earlier"
                      disabled={i === 0}
                      onClick={() => moveCatalogue(c, -1)}
                    >
                      <ArrowUp data-slot="icon" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Search later"
                      disabled={i === enabled.length - 1}
                      onClick={() => moveCatalogue(c, 1)}
                    >
                      <ArrowDown data-slot="icon" />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Ratings">
        <Choice
          label="Rate books with"
          value={prefs.ratingStyle}
          options={[
            { value: "half", label: "Half stars" },
            { value: "whole", label: "Whole stars" },
            { value: "ten", label: "A score out of 10" },
            { value: "off", label: "Don't use ratings" },
          ]}
          onChange={(v) => update({ ratingStyle: v })}
        />
      </Section>

      <Section title="Theme">
        <p className="text-sm text-muted-foreground">
          Choose a theme from the palette button in the top bar. Turn on
          “Match system light/dark” there to have it follow your device.
        </p>
      </Section>

      <Section title="Appearance">
        <AccentPicker value={prefs.accent} onChange={(a) => update({ accent: a })} />
        <Choice
          label="Books without a cover"
          value={prefs.coverArt}
          options={[
            { value: "drawn", label: "A drawn cover with the title" },
            { value: "plain", label: "A plain grey box" },
          ]}
          onChange={(v) => update({ coverArt: v })}
        />
        <Choice
          label="Corners"
          value={prefs.corners}
          options={[
            { value: "square", label: "Square" },
            { value: "rounded", label: "Rounded" },
            { value: "round", label: "Round" },
          ]}
          onChange={(v) => update({ corners: v })}
        />
        <BackgroundPicker value={prefs.background} onChange={(b) => update({ background: b })} />
      </Section>

      <Section title="Motion">
        <Choice
          label="Animations"
          hint="Always off when your device asks for reduced motion."
          value={prefs.motion}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => update({ motion: v })}
        />
      </Section>

      <Section title="Text">
        <Choice
          label="Text size"
          value={prefs.textSize}
          options={[
            { value: "normal", label: "Normal" },
            { value: "large", label: "Large" },
            { value: "larger", label: "Larger" },
          ]}
          onChange={(v) => update({ textSize: v })}
        />
        <Choice
          label="Font for long text"
          hint="Descriptions, reviews, quotes and notes."
          value={prefs.longTextFont}
          options={[
            { value: "sans", label: "Same as everything else" },
            { value: "serif", label: "Book-style serif" },
          ]}
          onChange={(v) => update({ longTextFont: v })}
        />
        <Choice
          label="Headings"
          hint="Page titles, book titles and card titles."
          value={prefs.headingFont}
          options={[
            { value: "sans", label: "Same as everything else" },
            { value: "serif", label: "Book-style serif" },
            { value: "rounded", label: "Rounded" },
          ]}
          onChange={(v) => update({ headingFont: v })}
        />
      </Section>

      <Section title="Pages and navigation">
        <Choice
          label="Start page"
          hint="Where the app opens, and where the logo goes."
          value={prefs.startPage}
          options={[
            { value: "library", label: "Library" },
            { value: "stats", label: "Stats" },
            { value: "add", label: "Add book" },
            { value: "reading", label: "Now reading" },
          ]}
          onChange={(v) => update({ startPage: v })}
        />
        {savedViews.length > 0 && (
          <Choice
            label="Library opens on"
            value={
              savedViews.some((v) => v.id === prefs.defaultViewId) ? prefs.defaultViewId : "none"
            }
            options={[
              { value: "none", label: "The whole library" },
              ...views.map((v) => ({ value: v.id, label: `Saved view: ${v.name}` })),
            ]}
            onChange={(v) => update({ defaultViewId: v === "none" ? "" : v })}
          />
        )}
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Show in the top bar</p>
          {HIDEABLE_NAV.map((item) => (
            <Toggle
              key={item}
              label={NAV_LABELS[item]}
              checked={!prefs.hiddenNav.includes(item)}
              onChange={(shown) => update({ hiddenNav: toggleIn(prefs.hiddenNav, item, !shown) })}
            />
          ))}
        </div>
      </Section>

      <Section title="Stats page">
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Show these cards</p>
          {HIDEABLE_STATS.map((card) => (
            <Toggle
              key={card}
              label={STATS_LABELS[card]}
              checked={!prefs.hiddenStats.includes(card)}
              onChange={(shown) =>
                update({ hiddenStats: toggleIn(prefs.hiddenStats, card, !shown) })
              }
            />
          ))}
        </div>
        <Choice
          label="Calendar shading"
          hint="Pages a day for each shade of the reading calendar."
          value={prefs.heatmapScale}
          options={[
            { value: "standard", label: "Standard (20, 50, 100 pages)" },
            { value: "gentle", label: "Gentle (10, 25, 50 pages)" },
            { value: "heavy", label: "Heavy (50, 100, 200 pages)" },
            { value: "auto", label: "Based on my usual day" },
          ]}
          onChange={(v) => update({ heatmapScale: v })}
        />
      </Section>

      {savedViews.length > 0 && (
        <SavedViewsList views={views} onReorder={(ids) => update({ savedViewOrder: ids })} />
      )}
    </div>
  );
}

/** Saved library views: rename, reorder (the chips above the library
 *  follow this order) or delete. Views are saved from the library's filter
 *  bar. */
function SavedViewsList({
  views,
  onReorder,
}: {
  /** In the reader's order. */
  views: { id: string; name: string }[];
  /** Saves a new order, through the form's own save and status line. */
  onReorder: (ids: string[]) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A deleted view leaves the list at once, so focus can go to the next.
  const [gone, setGone] = useState<string[]>([]);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = views.filter((v) => !gone.includes(v.id));

  /** Focus the first of `selectors` that is there and enabled, once React
   *  has redrawn the list: a moved or removed row takes the focus with it
   *  otherwise. */
  function focusSoon(...selectors: string[]) {
    requestAnimationFrame(() => {
      for (const selector of selectors) {
        const el = listRef.current?.querySelector<HTMLButtonElement>(selector);
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
    });
  }

  function cancel(id: string) {
    setEditing(null);
    setError(null);
    focusSoon(`[data-rename="${id}"]`);
  }

  function submitRename(view: { id: string; name: string }) {
    const to = newName.trim();
    if (!to || to === view.name) {
      cancel(view.id);
      return;
    }
    startTransition(async () => {
      const res = await renameView(view.id, to);
      if (res.error) {
        setError(res.error);
        return;
      }
      cancel(view.id);
      router.refresh();
    });
  }

  function move(view: { id: string }, by: -1 | 1) {
    onReorder(
      moveId(
        rows.map((v) => v.id),
        view.id,
        by,
      ),
    );
    focusSoon(`[data-move="${view.id}:${by}"]`, `[data-move="${view.id}:${-by}"]`);
  }

  function remove(view: { id: string }) {
    const i = rows.findIndex((v) => v.id === view.id);
    const neighbour = rows[i + 1] ?? rows[i - 1];
    startTransition(async () => {
      await deleteView(view.id);
      setGone((g) => [...g, view.id]);
      if (neighbour) focusSoon(`[data-rename="${neighbour.id}"]`);
      router.refresh();
    });
  }

  return (
    <Section title="Saved views">
      <ul ref={listRef} className="grid gap-1">
        {rows.map((v, i) => (
          <li key={v.id} className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {editing === v.id ? (
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename(v);
                }}
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancel(v.id);
                    }
                  }}
                  maxLength={SAVED_VIEW_NAME_MAX}
                  autoFocus
                  aria-label={`New name for “${v.name}”`}
                  className="h-8 min-w-0 flex-1 basis-40"
                />
                <span className="flex gap-1">
                  <Button type="submit" size="sm" disabled={pending}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => cancel(v.id)}>
                    Cancel
                  </Button>
                </span>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-rename={v.id}
                    title="Rename"
                    aria-label={`Rename “${v.name}”`}
                    onClick={() => {
                      setEditing(v.id);
                      setNewName(v.name);
                      setError(null);
                    }}
                  >
                    <Pencil data-slot="icon" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-move={`${v.id}:-1`}
                    title="Move up"
                    aria-label={`Move “${v.name}” up`}
                    disabled={i === 0}
                    onClick={() => move(v, -1)}
                  >
                    <ArrowUp data-slot="icon" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-move={`${v.id}:1`}
                    title="Move down"
                    aria-label={`Move “${v.name}” down`}
                    disabled={i === rows.length - 1}
                    onClick={() => move(v, 1)}
                  >
                    <ArrowDown data-slot="icon" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title={`Delete “${v.name}”`}
                    aria-label={`Delete “${v.name}”`}
                    disabled={pending}
                    onClick={() => remove(v)}
                  >
                    <Trash2 data-slot="icon" />
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-sm text-destructive">
        {error}
      </p>
    </Section>
  );
}
