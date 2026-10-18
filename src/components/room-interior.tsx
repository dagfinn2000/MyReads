"use client";

/**
 * Decorate's controls for the inside of the house: its wallpaper and floor,
 * what hangs along the ceilings, its windows, what grows round it, each
 * added room's own paint, wallpaper and floor, and whether a room goes
 * upstairs or next to the one before it. Each choice is pictured in the
 * house's colours.
 */
import { useMemo } from "react";
import { Rects, type Art } from "@/components/room-art";
import { ceilingSample, floorSample, styleFloor, stylePaper, wallSample } from "@/components/room-shells";
import { climberSample, gardenSample } from "@/components/room-garden";
import { windowSample } from "@/components/room-windows";
import { Row, Swatches, Tiles } from "@/components/decorate-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { decorData, type RoomDecor } from "@/components/reading-room";
import { ROOM_LABELS, type RoomKind } from "@/lib/room";
import { cn } from "@/lib/utils";
import {
  COLOUR_LABELS,
  ROOM_CEILINGS,
  ROOM_CEILING_LABELS,
  ROOM_CLIMBERS,
  ROOM_CLIMBER_LABELS,
  ROOM_GARDEN,
  ROOM_GARDEN_LABELS,
  ROOM_WINDOWS,
  ROOM_WINDOW_LABELS,
  ROOM_FLOORS,
  ROOM_FLOOR_LABELS,
  ROOM_PAPERS,
  ROOM_PAPER_LABELS,
  ROOM_WALLS,
  SAME_AS_HOUSE,
  WALL_SWATCHES,
  type RoomOwn,
} from "@/lib/room-styles";

/** A picture for a tile, in the house's colours. */
function Sample({ art: a, decor, scale = 2 }: { art: Art; decor: RoomDecor; scale?: number }) {
  return (
    <span className="room-scene block" {...decorData(decor)}>
      <svg
        width={a.w * scale}
        height={a.h * scale}
        viewBox={`0 0 ${a.w} ${a.h}`}
        shapeRendering="crispEdges"
        className="block"
        aria-hidden="true"
        focusable="false"
      >
        <Rects rects={a.rects} />
      </svg>
    </span>
  );
}

/** Wallpaper, floor and ceiling for the whole house (Decorate › House). */
export function InteriorControls({ decor, onChange }: { decor: RoomDecor; onChange: (patch: Partial<RoomDecor>) => void }) {
  const papers = useMemo(
    () => new Map(ROOM_PAPERS.map((p) => [p, wallSample(p === "style" ? stylePaper(decor.style) : p, 27, 27)])),
    [decor.style],
  );
  const floors = useMemo(
    () => new Map(ROOM_FLOORS.map((f) => [f, floorSample(f === "style" ? styleFloor(decor.style) : f, 18, f !== "style")])),
    [decor.style],
  );
  const ceilings = useMemo(() => new Map(ROOM_CEILINGS.map((c) => [c, ceilingSample(c, 27, 20)])), []);
  return (
    <>
      <Tiles
        label="Wallpaper"
        hint="Printed in the walls' colour."
        options={ROOM_PAPERS}
        labels={ROOM_PAPER_LABELS}
        chosen={(paper) => decor.paper === paper}
        onPick={(paper) => onChange({ paper })}
      >
        {(paper) => <Sample art={papers.get(paper)!} decor={decor} />}
      </Tiles>
      <Tiles
        label="Floor"
        hint="Wooden floors are in the wood's colour, carpet in the fabrics'."
        options={ROOM_FLOORS}
        labels={ROOM_FLOOR_LABELS}
        chosen={(floor) => decor.floor === floor}
        onPick={(floor) => onChange({ floor })}
      >
        {(floor) => <Sample art={floors.get(floor)!} decor={decor} scale={3} />}
      </Tiles>
      <Tiles
        label="Along the ceilings"
        hint="In every room, over the bookcases. Fairy lights twinkle at night."
        options={ROOM_CEILINGS}
        labels={ROOM_CEILING_LABELS}
        chosen={(ceiling) => decor.ceiling === ceiling}
        onPick={(ceiling) => onChange({ ceiling })}
      >
        {(ceiling) => <Sample art={ceilings.get(ceiling)!} decor={decor} />}
      </Tiles>
    </>
  );
}

/** Windows, and what grows up the walls and round the house (Decorate ›
 *  House). */
export function OutsideControls({ decor, onChange }: { decor: RoomDecor; onChange: (patch: Partial<RoomDecor>) => void }) {
  const windows = useMemo(() => new Map(ROOM_WINDOWS.map((w) => [w, windowSample(w, 27, 44)])), []);
  const climbers = useMemo(() => new Map(ROOM_CLIMBERS.map((c) => [c, climberSample(c, 27, 44)])), []);
  const garden = useMemo(() => new Map(ROOM_GARDEN.map((g) => [g, gardenSample(g, 27, 27)])), []);
  const cave = decor.style === "cave";
  return (
    <>
      <Tiles
        label="Windows"
        hint="In every room, wherever the wall is clear of furniture."
        options={ROOM_WINDOWS}
        labels={ROOM_WINDOW_LABELS}
        chosen={(windows) => decor.windows === windows}
        onPick={(windows) => onChange({ windows })}
        tall
      >
        {(w) => <Sample art={windows.get(w)!} decor={decor} />}
      </Tiles>
      <Tiles
        label="Up the walls"
        hint={cave ? "A cave has no outside walls to climb." : "Up both sides of the house to the eaves."}
        options={ROOM_CLIMBERS}
        labels={ROOM_CLIMBER_LABELS}
        chosen={(climber) => decor.climber === climber}
        onPick={(climber) => onChange({ climber })}
        tall
      >
        {(c) => <Sample art={climbers.get(c)!} decor={decor} />}
      </Tiles>
      <Tiles
        label="In the garden"
        hint={cave ? "A cave's garden is its hill." : "Pick as many as you like."}
        options={ROOM_GARDEN}
        labels={ROOM_GARDEN_LABELS}
        multiple
        chosen={(item) => decor.garden.includes(item)}
        onPick={(item) =>
          onChange({
            garden: decor.garden.includes(item)
              ? decor.garden.filter((g) => g !== item)
              : ROOM_GARDEN.filter((g) => g === item || decor.garden.includes(g)),
          })
        }
      >
        {(g) => <Sample art={garden.get(g)!} decor={decor} />}
      </Tiles>
    </>
  );
}

/** Whether each added room goes on a floor of its own or next to the one
 *  before it (Decorate › Rooms). */
export function RoomPlaceControls({
  rooms,
  beside,
  upstairs,
  onChange,
}: {
  rooms: readonly RoomKind[];
  beside: readonly RoomKind[];
  /** Rooms that are on a floor of their own, as the house is now. */
  upstairs: readonly RoomKind[];
  onChange: (room: RoomKind, beside: boolean) => void;
}) {
  return (
    <div className="grid gap-2">
      {rooms.map((room, i) => {
        const next = beside.includes(room);
        const before = i === 0 ? "the library" : `the ${ROOM_LABELS[rooms[i - 1]].name.toLowerCase()}`;
        return (
          <div key={room} className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
            <div>
              <p id={`place-${room}`} className="text-sm font-medium">
                {ROOM_LABELS[room].name}
              </p>
              {next && upstairs.includes(room) && (
                <p className="text-xs text-muted-foreground">No space beside it on this screen, so it&apos;s upstairs.</p>
              )}
            </div>
            <div role="radiogroup" aria-labelledby={`place-${room}`} className="inline-flex justify-self-start rounded-md border p-0.5">
              {[false, true].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  role="radio"
                  aria-checked={next === on}
                  onClick={() => onChange(room, on)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    next === on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {on ? `Next to ${before}` : "Upstairs"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LIKE_HOUSE = "Like the rest of the house";

function Pick<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger size="sm" aria-label={label} className="w-60 max-w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o === "style" ? LIKE_HOUSE : labels[o]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

/** Each added room's own paint, wallpaper and floor (Decorate › Rooms). */
export function RoomOwnControls({
  rooms,
  decor,
  onChange,
}: {
  rooms: readonly RoomKind[];
  decor: RoomDecor;
  onChange: (patch: Partial<RoomDecor>) => void;
}) {
  const set = (room: RoomKind, patch: Partial<RoomOwn>) => {
    const next = { ...(decor.own[room] ?? SAME_AS_HOUSE), ...patch };
    const own = { ...decor.own };
    if (next.walls === "style" && next.paper === "style" && next.floor === "style") delete own[room];
    else own[room] = next;
    onChange({ own });
  };
  return (
    <div className="grid gap-5">
      {rooms.map((room) => {
        const own = decor.own[room] ?? SAME_AS_HOUSE;
        return (
          <div key={room} role="group" aria-labelledby={`own-${room}`} className="grid gap-2">
            <p id={`own-${room}`} className="text-sm font-semibold">
              {ROOM_LABELS[room].name}
            </p>
            <Swatches
              label="Paint"
              value={own.walls}
              options={ROOM_WALLS}
              swatches={WALL_SWATCHES}
              labels={{ ...COLOUR_LABELS, style: "Like the rest of the house" }}
              styleText="The house's"
              onChange={(walls) => set(room, { walls })}
            />
            <Pick
              label="Wallpaper"
              value={own.paper}
              options={ROOM_PAPERS}
              labels={ROOM_PAPER_LABELS}
              onChange={(paper) => set(room, { paper })}
            />
            <Pick
              label="Floor"
              value={own.floor}
              options={ROOM_FLOORS}
              labels={ROOM_FLOOR_LABELS}
              onChange={(floor) => set(room, { floor })}
            />
          </div>
        );
      })}
    </div>
  );
}
