"use client";

import { useMemo } from "react";
import { Dices, RotateCcw } from "lucide-react";
import { HEAD_ROWS, SEAT_OFFSET, WAIST_ROWS, avatarPose } from "@/components/avatar-art";
import { Rects, Sprite, armchairArt } from "@/components/room-art";
import { AvatarPortrait, avatarColours, useAvatar } from "@/components/room-avatar";
import { Swatches, Tiles } from "@/components/decorate-controls";
import { Button } from "@/components/ui/button";
import {
  AVATAR_BOTTOMS,
  AVATAR_EXTRAS,
  AVATAR_HAIRS,
  AVATAR_HAIR_COLOURS,
  AVATAR_HATS,
  AVATAR_LABELS,
  AVATAR_LEGS,
  AVATAR_SKINS,
  AVATAR_TOPS,
  DEFAULT_AVATAR,
  HAIR_SWATCHES,
  LEGS_SWATCHES,
  SKIN_SWATCHES,
  TOP_SWATCHES,
  randomLook,
  type AvatarLook,
} from "@/lib/avatar";

const ARMCHAIR = armchairArt();

/**
 * The avatar maker, under Decorate on the Room page: how the reader's
 * little self looks, shown standing and in the armchair as it changes, and
 * whether it's in the room at all.
 */
export function AvatarMaker({
  look,
  shown,
  onChange,
  onShown,
  scene,
}: {
  look: AvatarLook;
  shown: boolean;
  /** The room's decor as data attributes (decorData), so the picture is
   *  in the room's own colours. */
  scene: Record<string, string | undefined>;
  onChange: (look: AvatarLook) => void;
  onShown: (shown: boolean) => void;
}) {
  const set = (patch: Partial<AvatarLook>) => onChange({ ...look, ...patch });
  const toggle = <K extends AvatarLook["extras"][number]>(extra: K) =>
    set({ extras: look.extras.includes(extra) ? look.extras.filter((e) => e !== extra) : [...look.extras, extra] });

  return (
    <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
      <div className="grid justify-items-center gap-3 md:sticky md:top-16">
        <Stage look={look} scene={scene} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange(randomLook())}>
            <Dices aria-hidden="true" />
            Surprise me
          </Button>
          {JSON.stringify(look) !== JSON.stringify(DEFAULT_AVATAR) && (
            <Button size="sm" variant="ghost" onClick={() => onChange(DEFAULT_AVATAR)}>
              <RotateCcw aria-hidden="true" />
              Start again
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={shown}
            onChange={(e) => onShown(e.target.checked)}
          />
          Show me in the reading room
          <span className="text-xs text-muted-foreground">
            Walking about, or in the armchair while you&apos;re reading a book.
          </span>
        </label>

        <Swatches
          label="Skin"
          value={look.skin}
          options={AVATAR_SKINS}
          swatches={SKIN_SWATCHES}
          labels={AVATAR_LABELS}
          onChange={(skin) => set({ skin })}
        />
        <Tiles
          label="Hair"
          options={AVATAR_HAIRS}
          labels={AVATAR_LABELS}
          chosen={(hair) => look.hair === hair}
          onPick={(hair) => set({ hair })}
        >
          {(hair) => <Part look={{ ...look, hair, hat: "none" }} part="face" />}
        </Tiles>
        <Swatches
          label="Hair colour"
          value={look.hairColour}
          options={AVATAR_HAIR_COLOURS}
          swatches={HAIR_SWATCHES}
          labels={AVATAR_LABELS}
          onChange={(hairColour) => set({ hairColour })}
        />
        <Tiles
          label="On your head"
          options={AVATAR_HATS}
          labels={AVATAR_LABELS}
          chosen={(hat) => look.hat === hat}
          onPick={(hat) => set({ hat })}
        >
          {(hat) => <Part look={{ ...look, hat }} part="hat" />}
        </Tiles>
        <Tiles
          label="Face"
          hint="As many as you like."
          multiple
          options={AVATAR_EXTRAS}
          labels={AVATAR_LABELS}
          chosen={(extra) => look.extras.includes(extra)}
          onPick={toggle}
        >
          {(extra) => <Part look={{ ...look, hat: "none", extras: [extra] }} part="face" />}
        </Tiles>
        <Swatches
          label="Jumper"
          value={look.top}
          options={AVATAR_TOPS}
          swatches={TOP_SWATCHES}
          labels={AVATAR_LABELS}
          onChange={(top) => set({ top })}
        />
        <Tiles
          label="Below"
          options={AVATAR_BOTTOMS}
          labels={AVATAR_LABELS}
          chosen={(bottom) => look.bottom === bottom}
          onPick={(bottom) => set({ bottom })}
        >
          {(bottom) => <Part look={{ ...look, bottom }} part="legs" />}
        </Tiles>
        <Swatches
          label={look.bottom === "skirt" ? "Skirt" : "Trousers"}
          value={look.legs}
          options={AVATAR_LEGS}
          swatches={LEGS_SWATCHES}
          labels={AVATAR_LABELS}
          onChange={(legs) => set({ legs })}
        />
      </div>
    </div>
  );
}

/** The avatar against a bit of wall: on its feet, and in the armchair with
 *  a book. */
function Stage({ look, scene }: { look: AvatarLook; scene: Record<string, string | undefined> }) {
  const avatar = useAvatar(look)!;
  const s = 3;
  return (
    <div
      className="room-scene room-avatar-stage flex items-end gap-6 rounded-lg border px-6 pt-4"
      aria-hidden="true"
      {...scene}
      style={{ "--u": `${s}px` } as React.CSSProperties}
    >
      <AvatarPortrait avatar={avatar} pose="stand" scale={s} walking />
      <div className="relative" style={{ width: ARMCHAIR.w * s, height: (ARMCHAIR.h - SEAT_OFFSET.y) * s }}>
        <Sprite art={ARMCHAIR} scale={s} className="room-abs" style={{ left: 0, bottom: 0 }} />
        <div className="room-abs" style={{ left: SEAT_OFFSET.x * s, top: 0 }}>
          <AvatarPortrait avatar={avatar} pose="sit" scale={s} />
        </div>
      </div>
    </div>
  );
}

/** Rows of the standing figure each kind of option shows, and how big. */
const PARTS = {
  face: { top: 8, rows: HEAD_ROWS - 8, scale: 3 },
  hat: { top: 0, rows: HEAD_ROWS, scale: 2 },
  legs: { top: WAIST_ROWS - 4, rows: 18, scale: 3 },
};

/** Part of a look, as the picture on an option. */
function Part({ look, part }: { look: AvatarLook; part: keyof typeof PARTS }) {
  const a = useMemo(() => avatarPose(look, "stand"), [look]);
  const { top, rows, scale: s } = PARTS[part];
  return (
    <svg
      width={a.w * s}
      height={rows * s}
      viewBox={`0 ${top} ${a.w} ${rows}`}
      shapeRendering="crispEdges"
      className="room-avatar"
      style={avatarColours(look)}
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={a.rects} />
    </svg>
  );
}
