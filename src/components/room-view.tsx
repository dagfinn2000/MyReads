"use client";

import { useRef, useState } from "react";
import { Check, Move, Paintbrush, RotateCcw } from "lucide-react";
import { savePreferences } from "@/lib/actions/preferences";
import type { Preferences } from "@/lib/preferences";
import {
  FURNITURE_LABELS,
  MILESTONES,
  NO_ARRANGEMENT,
  STOWABLE,
  bringOut,
  putAway,
  type Arrangement,
  type Placement,
  type RoomBook,
  type Stowable,
} from "@/lib/room";
import {
  COLOUR_LABELS,
  FABRIC_SWATCHES,
  ROOM_FABRICS,
  ROOM_HANGINGS,
  ROOM_HANGING_LABELS,
  ROOM_STYLES,
  ROOM_STYLE_LABELS,
  ROOM_WALLS,
  ROOM_WOODS,
  WALL_SWATCHES,
  WOOD_SWATCHES,
} from "@/lib/room-styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HangingPreview,
  HousePreview,
  PLAIN_DECOR,
  ReadingRoom,
  decorData,
  type RoomDecor,
} from "@/components/reading-room";

const PREFERENCE: Record<keyof RoomDecor, keyof Preferences> = {
  style: "roomStyle",
  walls: "roomWalls",
  wood: "roomWood",
  fabric: "roomFabric",
  hanging: "roomHanging",
};

const sameDecor = (a: RoomDecor, b: RoomDecor) =>
  (Object.keys(PREFERENCE) as (keyof RoomDecor)[]).every((k) => a[k] === b[k]);

/**
 * The reading room with its Decorate panel: the house style, the colours of
 * the walls, wood and fabrics, what hangs over the fireplace, which
 * furniture is out, and a mode for moving the furniture about. Every
 * change shows at once and is saved on the account.
 */
export function RoomView({
  books,
  decor: savedDecor,
  layout,
  away,
  summary,
}: {
  books: RoomBook[];
  decor: RoomDecor;
  layout: Placement[];
  away: Stowable[];
  /** "198 books on 5 bookcases", beside the title. */
  summary: string | null;
}) {
  const [decor, setDecor] = useState(savedDecor);
  const [arrangement, setArrangement] = useState<Arrangement>(() => ({ places: layout, away }));
  const [panel, setPanel] = useState(false);
  const [arranging, setArranging] = useState(false);
  const moveButton = useRef<HTMLButtonElement>(null);

  const change = (patch: Partial<RoomDecor>) => {
    setDecor((d) => ({ ...d, ...patch }));
    const prefs = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [PREFERENCE[k as keyof RoomDecor], v]),
    ) as Partial<Preferences>;
    savePreferences(prefs).catch(() => {});
  };

  const arrange = (next: Arrangement) => {
    setArrangement(next);
    savePreferences({ roomLayout: [...next.places], roomAway: [...next.away] }).catch(() => {});
  };

  const stopArranging = () => {
    setArranging(false);
    moveButton.current?.focus();
  };

  const moved = arrangement.places.length > 0 || arrangement.away.length > 0;
  // Only the furniture the library has earned so far.
  const earned = STOWABLE.filter((k) => books.length >= MILESTONES[k]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reading room</h1>
          {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={panel}
            aria-controls="room-decorate"
            onClick={() => setPanel((p) => !p)}
          >
            <Paintbrush aria-hidden="true" />
            Decorate
          </Button>
          <Button
            ref={moveButton}
            variant={arranging ? "default" : "outline"}
            size="sm"
            aria-pressed={arranging}
            onClick={() => {
              setArranging((a) => !a);
              setPanel(false);
            }}
          >
            <Move aria-hidden="true" />
            Move furniture
          </Button>
        </div>
      </div>

      {panel && (
        <section
          id="room-decorate"
          aria-label="Decorate"
          className="grid gap-5 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
        >
          <Group title="House">
            <div
              role="radiogroup"
              aria-label="House style"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {ROOM_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={decor.style === style}
                  title={ROOM_STYLE_LABELS[style].blurb}
                  onClick={() => change({ style })}
                  className="group grid gap-1 rounded-lg p-1 text-center text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "room-scene room-thumb rounded-md border ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                      decor.style === style && "ring-2 ring-foreground",
                    )}
                    {...decorData({ ...decor, style })}
                  >
                    <HousePreview style={style} hanging={decor.hanging} />
                  </span>
                  <span className={cn("leading-tight", decor.style === style && "font-medium text-foreground")}>
                    {ROOM_STYLE_LABELS[style].name}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{ROOM_STYLE_LABELS[decor.style].blurb}</p>
          </Group>

          <Group title="Colours">
            <Swatches
              label="Walls"
              value={decor.walls}
              options={ROOM_WALLS}
              swatches={WALL_SWATCHES}
              onChange={(walls) => change({ walls })}
            />
            <Swatches
              label="Wood"
              value={decor.wood}
              options={ROOM_WOODS}
              swatches={WOOD_SWATCHES}
              onChange={(wood) => change({ wood })}
            />
            <Swatches
              label="Fabrics"
              hint="Chairs, curtains, rugs and tapestries."
              value={decor.fabric}
              options={ROOM_FABRICS}
              swatches={FABRIC_SWATCHES}
              onChange={(fabric) => change({ fabric })}
            />
          </Group>

          <Group title="Over the fireplace">
            <div role="radiogroup" aria-label="Over the fireplace" className="flex flex-wrap gap-2">
              {ROOM_HANGINGS.map((hanging) => (
                <button
                  key={hanging}
                  type="button"
                  role="radio"
                  aria-checked={decor.hanging === hanging}
                  aria-label={ROOM_HANGING_LABELS[hanging]}
                  title={ROOM_HANGING_LABELS[hanging]}
                  onClick={() => change({ hanging })}
                  className="group rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "room-scene room-wall-tile grid h-[6.5rem] w-[4.75rem] place-items-center rounded-md border ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                      decor.hanging === hanging && "ring-2 ring-foreground",
                    )}
                    {...decorData(decor)}
                  >
                    {hanging === "none" ? (
                      <span className="text-[11px] text-muted-foreground">Nothing</span>
                    ) : (
                      <HangingPreview hanging={hanging} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Furniture">
            {earned.length > 0 ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {earned.map((kind) => (
                  <label key={kind} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={!arrangement.away.includes(kind)}
                      onChange={(e) => arrange(e.target.checked ? bringOut(arrangement, kind) : putAway(arrangement, kind))}
                    />
                    {FURNITURE_LABELS[kind]}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                More furniture moves in as your library grows: a plant at 10 books, a clock at 50.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPanel(false);
                  setArranging(true);
                }}
              >
                <Move aria-hidden="true" />
                Move furniture
              </Button>
              {moved && (
                <Button size="sm" variant="ghost" onClick={() => arrange(NO_ARRANGEMENT)}>
                  <RotateCcw aria-hidden="true" />
                  Put it all back
                </Button>
              )}
            </div>
          </Group>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {!sameDecor(decor, PLAIN_DECOR) && (
              <Button size="sm" variant="ghost" onClick={() => change(PLAIN_DECOR)}>
                <RotateCcw aria-hidden="true" />
                Back to the cottage
              </Button>
            )}
            <Button size="sm" onClick={() => setPanel(false)}>
              <Check aria-hidden="true" />
              Done
            </Button>
          </div>
        </section>
      )}

      {arranging && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-popover/95 px-3 py-2 text-sm text-popover-foreground shadow-md backdrop-blur">
          <p>Drag furniture to a new spot, or select it and use the arrow keys.</p>
          <div className="flex gap-2">
            {moved && (
              <Button size="sm" variant="ghost" onClick={() => arrange({ places: [], away: arrangement.away })}>
                <RotateCcw aria-hidden="true" />
                Put it back
              </Button>
            )}
            <Button size="sm" onClick={stopArranging}>
              <Check aria-hidden="true" />
              Done
            </Button>
          </div>
        </div>
      )}

      <ReadingRoom
        books={books}
        decor={decor}
        arrangement={arrangement}
        arranging={arranging}
        onArrange={arrange}
        onDone={stopArranging}
      />
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

/** A row of round colour buttons, the first keeping the style's own. */
function Swatches<T extends string>({
  label,
  hint,
  value,
  options,
  swatches,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly T[];
  swatches: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            aria-label={COLOUR_LABELS[o] ?? o}
            title={COLOUR_LABELS[o] ?? o}
            onClick={() => onChange(o)}
            className={cn(
              "h-7 rounded-full border-2 border-background ring-1 ring-border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              o === "style" ? "bg-muted px-2.5 text-xs" : "w-7",
              value === o && "ring-2 ring-foreground",
            )}
            style={o === "style" ? undefined : { background: swatches[o] }}
          >
            {o === "style" ? "Style's own" : null}
          </button>
        ))}
      </div>
    </div>
  );
}
