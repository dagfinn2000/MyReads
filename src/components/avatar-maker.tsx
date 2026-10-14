"use client";

import { useMemo, useState } from "react";
import { Dices, Plus, RotateCcw, X } from "lucide-react";
import { FIGURE_ORIGIN, SEAT_OFFSET, avatarPose, seatedTop, type AvatarPose } from "@/components/avatar-art";
import { PET_ART } from "@/components/pet-art";
import { Rects, Sprite, armchairArt } from "@/components/room-art";
import { AvatarPortrait, avatarColours, useAvatar } from "@/components/room-avatar";
import { SubTabs, Swatches, Tiles } from "@/components/decorate-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCENT_SWATCHES,
  AVATAR_ACCENTS,
  AVATAR_ACCESSORIES,
  AVATAR_BOTTOMS,
  AVATAR_CHEEKS,
  AVATAR_CLOTH_COLOURS,
  AVATAR_EARS,
  AVATAR_EYES,
  AVATAR_EYE_COLOURS,
  AVATAR_FACIAL_HAIR,
  AVATAR_HAIRS,
  AVATAR_HAIR_COLOURS,
  AVATAR_HATS,
  AVATAR_HEIGHTS,
  AVATAR_HELD,
  AVATAR_LABELS,
  AVATAR_MOBILITY,
  AVATAR_MOUTHS,
  AVATAR_SHOES,
  AVATAR_SKINS,
  AVATAR_TOPS,
  CLOTH_SWATCHES,
  DEFAULT_AVATAR,
  EYE_SWATCHES,
  HAIR_HIDING_HATS,
  HAIR_SWATCHES,
  LONG_TOPS,
  MAX_SAVED_LOOKS,
  SKIN_SWATCHES,
  randomLook,
  sameLook,
  type AvatarAccessory,
  type AvatarCheek,
  type AvatarHat,
  type AvatarLook,
} from "@/lib/avatar";
import { CAT_COATS, DOG_COATS, PETS, PET_LABELS, type CatCoat, type DogCoat, type Pet } from "@/lib/pets";

const ARMCHAIR = armchairArt();

const SECTIONS = [
  { value: "face", label: "Face" },
  { value: "hair", label: "Hair" },
  { value: "body", label: "Body" },
  { value: "clothes", label: "Clothes" },
  { value: "extras", label: "Hats & extras" },
  { value: "pet", label: "Pet" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];

/** Accessories worn on the head or at the neck, shown close up on their
 *  tiles; the rest (a backpack, a cape) need the whole back. */
const HEAD_THINGS: readonly AvatarAccessory[] = [
  "glasses",
  "sunglasses",
  "earrings",
  "headphones",
  "eyepatch",
  "monocle",
  "hearingaids",
];
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
  looks,
  pet,
  coats,
  onChange,
  onShown,
  onLooks,
  onPet,
  onCoats,
  scene,
}: {
  look: AvatarLook;
  shown: boolean;
  /** Looks kept to switch between. */
  looks: AvatarLook[];
  pet: Pet;
  /** The coats of the house's cats and dog. */
  coats: { cat: CatCoat; dog: DogCoat };
  /** The room's decor as data attributes (decorData), so the picture is
   *  in the room's own colours. */
  scene: Record<string, string | undefined>;
  onChange: (look: AvatarLook) => void;
  onShown: (shown: boolean) => void;
  onLooks: (looks: AvatarLook[]) => void;
  onPet: (pet: Pet) => void;
  onCoats: (coats: Partial<{ cat: CatCoat; dog: DogCoat }>) => void;
}) {
  const [section, setSection] = useState<Section>("face");
  const set = (patch: Partial<AvatarLook>) => onChange({ ...look, ...patch });
  const flip = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  const long = LONG_TOPS.includes(look.top);
  // The tiles show one thing changed on a plainer self, on its feet, so
  // it's easy to see.
  const bare: AvatarLook = {
    ...look,
    hat: "none",
    accessories: [],
    held: "nothing",
    mobility: "walk",
    height: "medium",
  };
  const saved = looks.findIndex((l) => sameLook(look, l));

  return (
    <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
      <div className="grid justify-items-center gap-3 md:sticky md:top-16">
        <Stage look={look} pet={pet} scene={scene} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange(randomLook(Math.random, look.mobility))}>
            <Dices aria-hidden="true" />
            Surprise me
          </Button>
          {!sameLook(DEFAULT_AVATAR, look) && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_AVATAR, mobility: look.mobility })}>
              <RotateCcw aria-hidden="true" />
              Start again
            </Button>
          )}
        </div>
        <div role="group" aria-labelledby="saved-looks" className="grid w-full max-w-64 gap-1.5">
          <p id="saved-looks" className="text-xs font-medium text-muted-foreground">
            Saved looks
          </p>
          <div className="flex flex-wrap gap-2">
            {looks.map((l, i) => (
              <div key={i} className="relative">
                <button
                  type="button"
                  aria-label={`Wear saved look ${i + 1}`}
                  aria-pressed={saved === i}
                  onClick={() => onChange(l)}
                  className={cn(
                    "room-scene room-avatar-tile grid size-12 place-items-end justify-center overflow-hidden rounded-md border ring-offset-2 ring-offset-card outline-none transition-shadow hover:border-ring/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                    saved === i && "ring-2 ring-foreground",
                  )}
                >
                  <Part look={l} part="bust" />
                </button>
                <button
                  type="button"
                  aria-label={`Forget saved look ${i + 1}`}
                  title="Forget this look"
                  onClick={() => onLooks(looks.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))}
            {saved < 0 && looks.length < MAX_SAVED_LOOKS && (
              <button
                type="button"
                onClick={() => onLooks([...looks, look])}
                className="grid size-12 place-items-center rounded-md border border-dashed text-[10px] leading-tight text-muted-foreground outline-none hover:border-ring/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid justify-items-center gap-0.5">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Save look
                </span>
              </button>
            )}
          </div>
          {looks.length === 0 && (
            <p className="text-xs text-muted-foreground">Keep a look here to switch back to it later.</p>
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
              <Swatches
                label="Eye colour"
                value={look.eyeColour}
                options={AVATAR_EYE_COLOURS}
                swatches={EYE_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(eyeColour) => set({ eyeColour })}
              />
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
                label="Ears"
                options={AVATAR_EARS}
                labels={AVATAR_LABELS}
                chosen={(ears) => look.ears === ears}
                onPick={(ears) => set({ ears })}
              >
                {(ears) => <Part look={{ ...bare, ears }} part="hair" />}
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
                hint={HAIR_HIDING_HATS.includes(look.hat) ? `Under the ${AVATAR_LABELS[look.hat].toLowerCase()}.` : undefined}
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

          {section === "body" && (
            <>
              <Tiles
                label="Height"
                tall
                options={AVATAR_HEIGHTS}
                labels={AVATAR_LABELS}
                chosen={(height) => look.height === height}
                onPick={(height) => set({ height })}
              >
                {(height) => <Figure look={{ ...bare, mobility: look.mobility, height }} />}
              </Tiles>
              <Tiles
                label="Getting about"
                tall
                hint="Everyone sits in the armchair to read."
                options={AVATAR_MOBILITY}
                labels={AVATAR_LABELS}
                chosen={(mobility) => look.mobility === mobility}
                onPick={(mobility) => set({ mobility })}
              >
                {(mobility) => <Figure look={{ ...bare, mobility }} />}
              </Tiles>
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
                {(hat) => (
                  <Part
                    look={{ ...bare, hat }}
                    part={hat === "headscarf" ? "scarf" : TALL_HATS.includes(hat) ? "tallHat" : "hat"}
                  />
                )}
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
                    part={HEAD_THINGS.includes(a) ? "face" : NECK_THINGS.includes(a) ? "neck" : a === "wings" ? "wings" : "back"}
                  />
                )}
              </Tiles>
              <Tiles
                label="In your hand"
                hint="Carried about the house; put down to read."
                options={AVATAR_HELD}
                labels={AVATAR_LABELS}
                chosen={(h) => look.held === h}
                onPick={(held) => set({ held })}
              >
                {(held) => <Part look={{ ...bare, held }} part="hand" />}
              </Tiles>
              <Swatches
                label="Trimmings"
                hint="Hat bands, scarves, the cape, wings, what you carry and the like."
                value={look.accent}
                options={AVATAR_ACCENTS}
                swatches={ACCENT_SWATCHES}
                labels={AVATAR_LABELS}
                onChange={(accent) => set({ accent })}
              />
            </>
          )}

          {section === "pet" && (
            <>
              <Tiles
                label="Your pet"
                hint="Follows you about the house, and sleeps at your feet while you read."
                options={PETS}
                labels={PET_LABELS}
                chosen={(p) => pet === p}
                onPick={onPet}
              >
                {(p) => (p === "none" ? <span className="self-center text-lg text-muted-foreground">–</span> : <PetPicture pet={p} coats={coats} />)}
              </Tiles>
              <Tiles
                label="The cats' coat"
                hint="Every cat in the house: yours, and the one in the armchair."
                options={CAT_COATS}
                labels={PET_LABELS}
                chosen={(cat) => coats.cat === cat}
                onPick={(cat) => onCoats({ cat })}
              >
                {(cat) => <PetPicture pet="cat" coats={{ ...coats, cat }} />}
              </Tiles>
              <Tiles
                label="The dog's coat"
                hint="Yours, and the one asleep in its basket."
                options={DOG_COATS}
                labels={PET_LABELS}
                chosen={(dog) => coats.dog === dog}
                onPick={(dog) => onCoats({ dog })}
              >
                {(dog) => <PetPicture pet="dog" coats={{ ...coats, dog }} />}
              </Tiles>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The avatar against a bit of wall: on its feet, and in the armchair with
 *  a book. */
function Stage({ look, pet, scene }: { look: AvatarLook; pet: Pet; scene: Record<string, string | undefined> }) {
  const avatar = useAvatar(look, pet)!;
  const s = 3;
  return (
    <div
      className="room-scene room-avatar-stage flex items-end gap-6 rounded-lg border px-6 pt-4"
      aria-hidden="true"
      {...scene}
      style={{ "--u": `${s}px` } as React.CSSProperties}
    >
      <AvatarPortrait avatar={avatar} pose="stand" scale={s} walking />
      <div className="relative" style={{ width: ARMCHAIR.w * s, height: (ARMCHAIR.h - seatedTop(avatar.art.sit)) * s }}>
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
  bust: { pose: "sit", x: [-1, 14], y: [-7, 16], scale: 2 },
  scarf: { pose: "sit", x: [-1, 14], y: [-3, 14], scale: 3 },
  hand: { pose: "stand", x: [7, 14], y: [16, 28], scale: 4 },
  hair: { pose: "sit", x: [-1, 14], y: [-4, 13], scale: 3 },
  hat: { pose: "stand", x: [-1, 14], y: [-9, 8], scale: 3 },
  tallHat: { pose: "stand", x: [-1, 14], y: [-14, 11], scale: 2 },
  neck: { pose: "sit", x: [-1, 14], y: [4, 19], scale: 3 },
  top: { pose: "stand", x: [-1, 14], y: [11, 28], scale: 3 },
  bottom: { pose: "stand", x: [-1, 14], y: [22, 38], scale: 3 },
  feet: { pose: "stand", x: [1, 12], y: [31, 38], scale: 4 },
  back: { pose: "stand", x: [-1, 14], y: [6, 33], scale: 2 },
  wings: { pose: "stand", x: [-1, 14], y: [3, 29], scale: 2 },
} satisfies Record<string, { pose: AvatarPose; x: [number, number]; y: [number, number]; scale: number }>;

/** Hats too tall for a close up. */
const TALL_HATS: readonly AvatarHat[] = ["tophat", "wizard", "witch", "bunnyears", "chef", "headwrap", "turban"];

/** A pet standing, in the coats chosen for cats and dogs. */
function PetPicture({ pet, coats }: { pet: Exclude<Pet, "none">; coats: { cat: CatCoat; dog: DogCoat } }) {
  const { stand } = PET_ART[pet];
  const s = 2;
  return (
    <span data-cat={coats.cat} data-dog={coats.dog} className="mb-1.5">
      <svg
        width={stand.w * s}
        height={stand.h * s}
        viewBox={`0 0 ${stand.w} ${stand.h}`}
        shapeRendering="crispEdges"
        className="block"
        aria-hidden="true"
        focusable="false"
      >
        <Rects rects={stand.rects} />
      </svg>
    </span>
  );
}

/** A whole figure, head to toe and at its own height, standing on the
 *  bottom of its tile. */
function Figure({ look }: { look: AvatarLook }) {
  const a = useMemo(() => avatarPose(look, "stand"), [look]);
  const top = Math.min(...a.rects.map((r) => r[1])) - 1;
  const h = a.h - top;
  const s = 2;
  return (
    <svg
      width={a.w * s}
      height={h * s}
      viewBox={`0 ${top} ${a.w} ${h}`}
      shapeRendering="crispEdges"
      className="room-avatar"
      style={avatarColours(look) as React.CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={a.rects} />
    </svg>
  );
}

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
