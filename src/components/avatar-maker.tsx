"use client";

import { useMemo, useState } from "react";
import { Dices, RotateCcw } from "lucide-react";
import { FIGURE_ORIGIN, SEAT_OFFSET, avatarPose, type AvatarPose } from "@/components/avatar-art";
import { Rects, Sprite, armchairArt } from "@/components/room-art";
import { AvatarPortrait, avatarColours, useAvatar } from "@/components/room-avatar";
import { SubTabs, Swatches, Tiles } from "@/components/decorate-controls";
import { Button } from "@/components/ui/button";
import {
  ACCENT_SWATCHES,
  AVATAR_ACCENTS,
  AVATAR_ACCESSORIES,
  AVATAR_BOTTOMS,
  AVATAR_CHEEKS,
  AVATAR_CLOTH_COLOURS,
  AVATAR_EYES,
  AVATAR_FACIAL_HAIR,
  AVATAR_HAIRS,
  AVATAR_HAIR_COLOURS,
  AVATAR_HATS,
  AVATAR_LABELS,
  AVATAR_MOUTHS,
  AVATAR_SHOES,
  AVATAR_SKINS,
  AVATAR_TOPS,
  CLOTH_SWATCHES,
  DEFAULT_AVATAR,
  HAIR_SWATCHES,
  LONG_TOPS,
  SKIN_SWATCHES,
  randomLook,
  type AvatarAccessory,
  type AvatarCheek,
  type AvatarHat,
  type AvatarLook,
} from "@/lib/avatar";

const ARMCHAIR = armchairArt();

const SECTIONS = [
  { value: "face", label: "Face" },
  { value: "hair", label: "Hair" },
  { value: "clothes", label: "Clothes" },
  { value: "extras", label: "Hats & extras" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];

/** Accessories worn on the head or at the neck, shown close up on their
 *  tiles; the rest (a backpack, a cape) need the whole back. */
const HEAD_THINGS: readonly AvatarAccessory[] = ["glasses", "sunglasses", "earrings", "headphones"];
const NECK_THINGS: readonly AvatarAccessory[] = ["necklace", "scarf", "bowtie"];

/**
 * The avatar maker, under Decorate on the Room page: the reader makes a
 * little self from a wardrobe of faces, hair, clothes, hats and odds and
 * ends, seen standing and in the armchair as it changes, and says whether
 * it's in the room at all.
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
  const [section, setSection] = useState<Section>("face");
  const set = (patch: Partial<AvatarLook>) => onChange({ ...look, ...patch });
  const flip = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  const long = LONG_TOPS.includes(look.top);
  // The tiles show one thing changed on a plainer self, so it's easy to see.
  const bare: AvatarLook = { ...look, hat: "none", accessories: [] };

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
        <label className="flex max-w-64 items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={shown}
            onChange={(e) => onShown(e.target.checked)}
          />
          <span>
            Show me in the reading room
            <span className="block text-xs text-muted-foreground">
              Walking about, or in the armchair while you&apos;re reading a book.
            </span>
          </span>
        </label>
      </div>

      <div className="grid min-w-0 gap-4">
        <SubTabs id="avatar" label="Avatar" tabs={SECTIONS} value={section} onChange={setSection} />

        <div id={`avatar-${section}`} role="tabpanel" aria-labelledby={`avatar-tab-${section}`} className="grid gap-4">
          {section === "face" && (
            <>
              <Swatches
                label="Skin"
                value={look.skin}
                options={AVATAR_SKINS}
                swatches={SKIN_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(skin) => set({ skin })}
              />
              <Tiles
                label="Eyes"
                options={AVATAR_EYES}
                labels={AVATAR_LABELS}
                chosen={(eyes) => look.eyes === eyes}
                onPick={(eyes) => set({ eyes })}
              >
                {(eyes) => <Part look={{ ...bare, eyes }} part="face" />}
              </Tiles>
              <Tiles
                label="Mouth"
                options={AVATAR_MOUTHS}
                labels={AVATAR_LABELS}
                chosen={(mouth) => look.mouth === mouth}
                onPick={(mouth) => set({ mouth })}
              >
                {(mouth) => <Part look={{ ...bare, mouth }} part="face" />}
              </Tiles>
              <Tiles
                label="Cheeks"
                hint="As many as you like."
                multiple
                options={AVATAR_CHEEKS}
                labels={AVATAR_LABELS}
                chosen={(cheek) => look.cheeks.includes(cheek)}
                onPick={(cheek: AvatarCheek) => set({ cheeks: flip(look.cheeks, cheek) })}
              >
                {(cheek) => <Part look={{ ...bare, cheeks: [cheek], facialHair: "none" }} part="face" />}
              </Tiles>
              <Tiles
                label="Beard"
                options={AVATAR_FACIAL_HAIR}
                labels={AVATAR_LABELS}
                chosen={(facialHair) => look.facialHair === facialHair}
                onPick={(facialHair) => set({ facialHair })}
              >
                {(facialHair) => <Part look={{ ...bare, facialHair }} part="face" />}
              </Tiles>
            </>
          )}

          {section === "hair" && (
            <>
              <Tiles
                label="Hairstyle"
                options={AVATAR_HAIRS}
                labels={AVATAR_LABELS}
                chosen={(hair) => look.hair === hair}
                onPick={(hair) => set({ hair })}
              >
                {(hair) => <Part look={{ ...bare, hair }} part="hair" />}
              </Tiles>
              <Swatches
                label="Hair colour"
                hint={look.facialHair !== "none" ? "And the beard's." : undefined}
                value={look.hairColour}
                options={AVATAR_HAIR_COLOURS}
                swatches={HAIR_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(hairColour) => set({ hairColour })}
              />
            </>
          )}

          {section === "clothes" && (
            <>
              <Tiles
                label="Top"
                hint={long ? "A dress or a robe goes all the way down." : undefined}
                options={AVATAR_TOPS}
                labels={AVATAR_LABELS}
                chosen={(top) => look.top === top}
                onPick={(top) => set({ top })}
              >
                {(top) => <Part look={{ ...bare, top }} part="top" />}
              </Tiles>
              <Swatches
                label={`${AVATAR_LABELS[look.top]} colour`}
                value={look.topColour}
                options={AVATAR_CLOTH_COLOURS}
                swatches={CLOTH_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(topColour) => set({ topColour })}
              />
              {!long && (
                <>
                  <Tiles
                    label="Bottoms"
                    options={AVATAR_BOTTOMS}
                    labels={AVATAR_LABELS}
                    chosen={(bottom) => look.bottom === bottom}
                    onPick={(bottom) => set({ bottom })}
                  >
                    {(bottom) => <Part look={{ ...bare, bottom }} part="bottom" />}
                  </Tiles>
                  <Swatches
                    label={`${AVATAR_LABELS[look.bottom]} colour`}
                    value={look.bottomColour}
                    options={AVATAR_CLOTH_COLOURS}
                    swatches={CLOTH_SWATCHES}
                    labels={AVATAR_LABELS}
                    onChange={(bottomColour) => set({ bottomColour })}
                  />
                </>
              )}
              <Tiles
                label="Shoes"
                options={AVATAR_SHOES}
                labels={AVATAR_LABELS}
                chosen={(shoes) => look.shoes === shoes}
                onPick={(shoes) => set({ shoes })}
              >
                {(shoes) => <Part look={{ ...bare, shoes }} part="feet" />}
              </Tiles>
            </>
          )}

          {section === "extras" && (
            <>
              <Tiles
                label="On your head"
                options={AVATAR_HATS}
                labels={AVATAR_LABELS}
                chosen={(hat) => look.hat === hat}
                onPick={(hat) => set({ hat })}
              >
                {(hat) => <Part look={{ ...bare, hat }} part={TALL_HATS.includes(hat) ? "tallHat" : "hat"} />}
              </Tiles>
              <Tiles
                label="Wearing"
                hint="As many as you like."
                multiple
                options={AVATAR_ACCESSORIES}
                labels={AVATAR_LABELS}
                chosen={(a) => look.accessories.includes(a)}
                onPick={(a) => set({ accessories: flip(look.accessories, a) })}
              >
                {(a) => (
                  <Part
                    look={{ ...bare, accessories: [a] }}
                    part={HEAD_THINGS.includes(a) ? "face" : NECK_THINGS.includes(a) ? "neck" : "back"}
                  />
                )}
              </Tiles>
              <Swatches
                label="Trimmings"
                hint="Hat bands, bows, scarves, the cape and the like."
                value={look.accent}
                options={AVATAR_ACCENTS}
                swatches={ACCENT_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(accent) => set({ accent })}
              />
            </>
          )}
        </div>
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

/** What each kind of option shows of the figure: which pose (the face
 *  from the front, the rest as it walks), which dots (figure columns and
 *  rows, counted from the top left of the head), and how big. */
const PARTS = {
  face: { pose: "sit", x: [1, 12], y: [1, 13], scale: 4 },
  hair: { pose: "sit", x: [-1, 14], y: [-4, 13], scale: 3 },
  hat: { pose: "stand", x: [-1, 14], y: [-9, 8], scale: 3 },
  tallHat: { pose: "stand", x: [-1, 14], y: [-14, 11], scale: 2 },
  neck: { pose: "sit", x: [-1, 14], y: [4, 19], scale: 3 },
  top: { pose: "stand", x: [-1, 14], y: [11, 28], scale: 3 },
  bottom: { pose: "stand", x: [-1, 14], y: [22, 38], scale: 3 },
  feet: { pose: "stand", x: [1, 12], y: [31, 38], scale: 4 },
  back: { pose: "stand", x: [-1, 14], y: [6, 33], scale: 2 },
} satisfies Record<string, { pose: AvatarPose; x: [number, number]; y: [number, number]; scale: number }>;

/** Hats too tall for a close up. */
const TALL_HATS: readonly AvatarHat[] = ["tophat", "wizard", "witch", "bunnyears"];

/** Part of a look, as the picture on an option. */
function Part({ look, part }: { look: AvatarLook; part: keyof typeof PARTS }) {
  const { pose, x, y, scale: s } = PARTS[part];
  const a = useMemo(() => avatarPose(look, pose), [look, pose]);
  const w = x[1] - x[0] + 1;
  const h = y[1] - y[0] + 1;
  return (
    <svg
      width={w * s}
      height={h * s}
      viewBox={`${x[0] + FIGURE_ORIGIN.x} ${y[0] + FIGURE_ORIGIN.y} ${w} ${h}`}
      shapeRendering="crispEdges"
      className="room-avatar"
      style={{ ...avatarColours(look), "--spine": "#7a3b4a" } as React.CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={a.rects} />
    </svg>
  );
}
