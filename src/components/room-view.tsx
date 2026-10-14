"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Move, Paintbrush, Plus, RotateCcw } from "lucide-react";
import { AvatarMaker } from "@/components/avatar-maker";
import { Group, Swatches } from "@/components/decorate-controls";
import type { AvatarLook } from "@/lib/avatar";
import type { Pet } from "@/lib/pets";
import { RoomSwitch } from "@/components/room-switch";
import { savePreferences } from "@/lib/actions/preferences";
import type { HideableNav, Preferences } from "@/lib/preferences";
import {
  EXTRAS,
  FURNITURE_LABELS,
  MILESTONES,
  ROOMS,
  ROOM_LABELS,
  ROOM_PIECES,
  STOWABLE,
  addExtra,
  addRoom,
  bringOut,
  putAway,
  removeExtra,
  removeRoom,
  type Arrangement,
  type Extra,
  type HousePlan,
  type Placement,
  type RoomBook,
  type RoomKind,
  type Stowable,
} from "@/lib/room";
import { ExtraPreview } from "@/components/room-extras";
import { RoomPreview } from "@/components/room-rooms";
import { InteriorControls, RoomOwnControls } from "@/components/room-interior";
import {
  COLOUR_LABELS,
  FABRIC_SWATCHES,
  ROOM_FABRICS,
  ROOM_HANGINGS,
  ROOM_FITTED,
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
  paper: "roomPaper",
  floor: "roomFloor",
  ceiling: "roomCeiling",
  own: "roomOwn",
  cat: "roomCat",
  dog: "roomDog",
};

/** The house's own decor, which "Back to the cottage" puts back; the
 *  added rooms keep their walls and floors, and the animals their coats. */
const HOUSE: (keyof RoomDecor)[] = ["style", "walls", "wood", "fabric", "hanging", "paper", "floor", "ceiling"];
const sameHouse = (a: RoomDecor, b: RoomDecor) => HOUSE.every((k) => a[k] === b[k]);

const TABS = [
  { value: "house", label: "House" },
  { value: "rooms", label: "Rooms & furniture" },
  { value: "avatar", label: "Avatar" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/**
 * The reading room with its Decorate panel: the house style, the colours of
 * the walls, wood and fabrics and what hangs over the fireplace; the rooms
 * added over the library, furniture added from a catalogue, which is out,
 * and a mode for moving it about; and, on its Avatar tab, the reader's own
 * little self. Every change
 * shows at once and is saved on the account.
 */
export function RoomView({
  books,
  decor: savedDecor,
  layout,
  away,
  rooms,
  extras,
  avatar: savedAvatar,
  avatarShown: savedShown,
  avatarLooks: savedLooks,
  pet: savedPet,
  hiddenNav,
  summary,
}: {
  books: RoomBook[];
  decor: RoomDecor;
  layout: Placement[];
  away: Stowable[];
  rooms: RoomKind[];
  extras: Extra[];
  avatar: AvatarLook;
  avatarShown: boolean;
  avatarLooks: AvatarLook[];
  pet: Pet;
  /** For the switch that turns the whole room off. */
  hiddenNav: HideableNav[];
  /** "198 books on 5 bookcases", beside the title. */
  summary: string | null;
}) {
  const [decor, setDecor] = useState(savedDecor);
  const [arrangement, setArrangement] = useState<Arrangement>(() => ({
    places: layout,
    away,
    rooms,
    extras,
  }));
  const [avatar, setAvatar] = useState(savedAvatar);
  const [avatarShown, setAvatarShown] = useState(savedShown);
  const [avatarLooks, setAvatarLooks] = useState(savedLooks);
  const [pet, setPet] = useState(savedPet);
  const [panel, setPanel] = useState(false);
  const [tab, setTab] = useState<Tab>("house");
  const [arranging, setArranging] = useState(false);
  const moveButton = useRef<HTMLButtonElement>(null);
  // What the house has room for at this width, to say when something
  // added from the catalogue hasn't found a place.
  const [inHouse, setInHouse] = useState<ReadonlySet<string> | null>(null);
  const onPlan = useCallback((plan: HousePlan) => setInHouse(new Set(plan.floors.flat().map((p) => p.kind))), []);

  const change = (patch: Partial<RoomDecor>) => {
    setDecor((d) => ({ ...d, ...patch }));
    const prefs = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [PREFERENCE[k as keyof RoomDecor], v]),
    ) as Partial<Preferences>;
    savePreferences(prefs).catch(() => {});
  };

  const arrange = (next: Arrangement) => {
    setArrangement(next);
    savePreferences({
      roomLayout: [...next.places],
      roomAway: [...next.away],
      roomRooms: [...(next.rooms ?? [])],
      roomExtras: [...(next.extras ?? [])],
    }).catch(() => {});
  };

  const changeAvatar = (look: AvatarLook) => {
    setAvatar(look);
    savePreferences({ avatar: look }).catch(() => {});
  };

  const keepLooks = (looks: AvatarLook[]) => {
    setAvatarLooks(looks);
    savePreferences({ avatarLooks: looks }).catch(() => {});
  };

  const choosePet = (next: Pet) => {
    setPet(next);
    savePreferences({ avatarPet: next }).catch(() => {});
  };

  const showAvatar = (shown: boolean) => {
    setAvatarShown(shown);
    savePreferences({ avatarShown: shown }).catch(() => {});
  };

  const stopArranging = () => {
    setArranging(false);
    moveButton.current?.focus();
  };

  const moved = arrangement.places.length > 0 || arrangement.away.length > 0;
  const added = arrangement.rooms ?? [];
  const addedExtras = arrangement.extras ?? [];
  const homeless = inHouse ? addedExtras.filter((k) => !inHouse.has(k)) : [];
  // Only the furniture the library has earned so far.
  const earned = STOWABLE.filter((k) => k in MILESTONES && books.length >= MILESTONES[k as keyof typeof MILESTONES]);
  const furnitureBox = (kind: Stowable) => (
    <label key={kind} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={!arrangement.away.includes(kind)}
        onChange={(e) => arrange(e.target.checked ? bringOut(arrangement, kind) : putAway(arrangement, kind))}
      />
      {FURNITURE_LABELS[kind]}
    </label>
  );

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
          <div role="tablist" aria-label="Decorate" className="flex gap-1 overflow-x-auto border-b">
            {TABS.map((t, i) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                id={`decorate-tab-${t.value}`}
                aria-selected={tab === t.value}
                aria-controls={`decorate-${t.value}`}
                tabIndex={tab === t.value ? 0 : -1}
                onClick={() => setTab(t.value)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].value;
                  setTab(next);
                  document.getElementById(`decorate-tab-${next}`)?.focus();
                }}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 pb-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === t.value
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "rooms" && (
            <div id="decorate-rooms" role="tabpanel" aria-labelledby="decorate-tab-rooms" className="grid gap-5">
              <Group title="Rooms">
                <p className="-mt-1 text-sm text-muted-foreground">
                  Each room you add is a new floor over your library, with its own furniture. Move it anywhere you like,
                  or put pieces away.
                </p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                  {ROOMS.map((room) => {
                    const on = added.includes(room);
                    return (
                      <button
                        key={room}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-describedby={`room-blurb-${room}`}
                        onClick={() => {
                          arrange(on ? removeRoom(arrangement, room) : addRoom(arrangement, room));
                          const fitted = ROOM_FITTED[room];
                          if (!on && fitted && !decor.own[room]) change({ own: { ...decor.own, [room]: fitted } });
                        }}
                        className="group grid content-start gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span
                          className={cn(
                            "room-scene room-room-thumb relative flex h-28 items-end justify-center overflow-hidden rounded-md border pb-1.5 ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                            on && "ring-2 ring-foreground",
                          )}
                          {...decorData(decor)}
                        >
                          {ROOM_PIECES[room].length > 0 ? (
                            <RoomPreview pieces={ROOM_PIECES[room]} />
                          ) : (
                            <span className="absolute inset-x-3 top-3 bottom-3 rounded-sm border border-dashed border-foreground/25" />
                          )}
                          <span
                            className={cn(
                              "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border bg-background/90 text-foreground shadow-sm",
                              !on && "opacity-0 transition-opacity group-hover:opacity-100",
                            )}
                            aria-hidden="true"
                          >
                            {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                          </span>
                        </span>
                        <span className={cn("text-sm leading-tight", on && "font-medium")}>
                          {ROOM_LABELS[room].name}
                        </span>
                        <span
                          id={`room-blurb-${room}`}
                          aria-hidden="true"
                          className="text-xs leading-snug text-muted-foreground"
                        >
                          {ROOM_LABELS[room].blurb}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Group>

              {added.length > 0 && (
                <Group title="Each room's walls and floor">
                  <RoomOwnControls rooms={added} decor={decor} onChange={change} />
                </Group>
              )}

              <Group title="Add furniture">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
                  {EXTRAS.map((kind) => {
                    const on = addedExtras.includes(kind);
                    const lost = homeless.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-describedby={lost ? `extra-lost-${kind}` : undefined}
                        onClick={() => arrange(on ? removeExtra(arrangement, kind) : addExtra(arrangement, kind))}
                        className="group grid content-start gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span
                          className={cn(
                            "room-scene room-room-thumb relative flex h-34 items-end justify-center overflow-hidden rounded-md border pb-1.5 ring-offset-2 ring-offset-card transition-shadow group-hover:border-ring/60",
                            on && "ring-2 ring-foreground",
                          )}
                          {...decorData(decor)}
                          style={{ "--u": "2px" } as React.CSSProperties}
                        >
                          <ExtraPreview kind={kind} scale={2} />
                          <span
                            className={cn(
                              "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border bg-background/90 text-foreground shadow-sm",
                              !on && "opacity-0 transition-opacity group-hover:opacity-100",
                            )}
                            aria-hidden="true"
                          >
                            {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                          </span>
                        </span>
                        <span className={cn("text-sm leading-tight", on && "font-medium")}>
                          {FURNITURE_LABELS[kind]}
                        </span>
                        {lost && (
                          <span id={`extra-lost-${kind}`} className="text-xs leading-snug text-muted-foreground">
                            No space for it on this screen
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {homeless.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {added.includes("spare")
                      ? "Take something out, or put something away, to make space for the rest."
                      : "Add a spare room, or put something away, to make space for the rest."}
                  </p>
                )}
              </Group>

              <Group title="Furniture">
                <div
                  role="group"
                  aria-labelledby={added.length > 0 ? "furniture-library" : undefined}
                  className="grid gap-1.5"
                >
                  {added.length > 0 && (
                    <p id="furniture-library" className="text-sm font-medium">
                      Library
                    </p>
                  )}
                  {earned.length > 0 ? (
                    <div className="flex flex-wrap gap-x-5 gap-y-2">{earned.map(furnitureBox)}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      More furniture moves in as your library grows: a plant at 10 books, a clock at 50.
                    </p>
                  )}
                </div>
                {added
                  .filter((room) => ROOM_PIECES[room].length > 0)
                  .map((room) => (
                    <div key={room} role="group" aria-labelledby={`furniture-${room}`} className="grid gap-1.5">
                      <p id={`furniture-${room}`} className="text-sm font-medium">
                        {ROOM_LABELS[room].name}
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">{ROOM_PIECES[room].map(furnitureBox)}</div>
                    </div>
                  ))}
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
                    <Button size="sm" variant="ghost" onClick={() => arrange({ ...arrangement, places: [], away: [] })}>
                      <RotateCcw aria-hidden="true" />
                      Put it all back
                    </Button>
                  )}
                </div>
              </Group>
            </div>
          )}

          {tab === "avatar" && (
            <div id="decorate-avatar" role="tabpanel" aria-labelledby="decorate-tab-avatar">
              <AvatarMaker
                look={avatar}
                shown={avatarShown}
                looks={avatarLooks}
                pet={pet}
                coats={{ cat: decor.cat, dog: decor.dog }}
                onChange={changeAvatar}
                onShown={showAvatar}
                onLooks={keepLooks}
                onPet={choosePet}
                onCoats={change}
                scene={decorData(decor)}
              />
            </div>
          )}

          {tab === "house" && (
            <div id="decorate-house" role="tabpanel" aria-labelledby="decorate-tab-house" className="grid gap-5">
              <Group title="House">
                <div role="radiogroup" aria-label="House style" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
                  labels={COLOUR_LABELS}
                  onChange={(walls) => change({ walls })}
                />
                <Swatches
                  label="Wood"
                  value={decor.wood}
                  options={ROOM_WOODS}
                  swatches={WOOD_SWATCHES}
                  labels={COLOUR_LABELS}
                  onChange={(wood) => change({ wood })}
                />
                <Swatches
                  label="Fabrics"
                  hint="Chairs, curtains, rugs and tapestries."
                  value={decor.fabric}
                  options={ROOM_FABRICS}
                  swatches={FABRIC_SWATCHES}
                  labels={COLOUR_LABELS}
                  onChange={(fabric) => change({ fabric })}
                />
              </Group>

              <Group title="Walls and floors">
                <InteriorControls decor={decor} onChange={change} />
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
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <RoomSwitch hiddenNav={hiddenNav} on={false} className="mr-auto text-muted-foreground" />
            {tab === "house" && !sameHouse(decor, PLAIN_DECOR) && (
              <Button size="sm" variant="ghost" onClick={() => change({ ...PLAIN_DECOR, own: decor.own, cat: decor.cat, dog: decor.dog })}>
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
              <Button size="sm" variant="ghost" onClick={() => arrange({ ...arrangement, places: [] })}>
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
        onPlan={onPlan}
        avatar={avatarShown ? avatar : null}
        pet={pet}
      />
    </>
  );
}
