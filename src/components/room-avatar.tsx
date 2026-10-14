"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { AVATAR_W, avatarArt, type AvatarArt } from "@/components/avatar-art";
import { petArt, type PetArt } from "@/components/pet-art";
import { Rects, Sprite, type Art } from "@/components/room-art";
import { ACCENT_SWATCHES, CLOTH_SWATCHES, EYE_SWATCHES, HAIR_SWATCHES, SKIN_SWATCHES, type AvatarLook } from "@/lib/avatar";
import { motionAllowed, subscribeMotion } from "@/lib/motion";
import type { Pet } from "@/lib/pets";

/** The avatar's art and the colours it's painted in, drawn once per look,
 *  and the pet who follows it about, if it has one. */
export interface Avatar {
  art: AvatarArt;
  colours: React.CSSProperties;
  pet: PetArt | null;
}

export function useAvatar(look: AvatarLook | null, pet: Pet = "none"): Avatar | null {
  return useMemo(
    () => (look ? { art: avatarArt(look), colours: avatarColours(look), pet: petArt(pet) } : null),
    [look, pet],
  );
}

export function avatarColours(look: AvatarLook): React.CSSProperties {
  return {
    "--av-skin": SKIN_SWATCHES[look.skin],
    "--av-eye": EYE_SWATCHES[look.eyeColour],
    "--av-hair": HAIR_SWATCHES[look.hairColour],
    "--av-top": CLOTH_SWATCHES[look.topColour],
    "--av-bottom": CLOTH_SWATCHES[look.bottomColour],
    "--av-accent": ACCENT_SWATCHES[look.accent],
  } as React.CSSProperties;
}

const useMotion = () => useSyncExternalStore(subscribeMotion, motionAllowed, () => false);

/** Dots a second. */
const SPEED = 14;
/** The pet trots a little faster, to keep up. */
const PET_SPEED = 19;
/** How long it stands about between walks, in ms. */
const REST = [2500, 6500];

/** A walking sprite: its two frames swap while it walks (reading-room.css). */
function Strider({ stand, stride }: { stand: Art; stride: Art }) {
  return (
    <svg
      width={stand.w}
      height={stand.h}
      viewBox={`0 0 ${stand.w} ${stand.h}`}
      shapeRendering="crispEdges"
      className="block size-full"
      focusable="false"
    >
      <Rects className="room-walk-stand" rects={stand.rects} />
      <Rects className="room-walk-stride" rects={stride.rects} />
    </svg>
  );
}

/**
 * The avatar pottering about a floor of the house while no book is being
 * read: it walks somewhere, stands a while, looks about, and now and then
 * comes back to stand by the fire. Its pet, if it has one, trots after it
 * and keeps at its heels, going round to the other side when it turns. It
 * moves a whole dot at a time, like the rest of the room. With Animations
 * off, or reduced motion, they just stand by the fire.
 *
 * `home` and `width` are in dots from the floor's left; `floorLine` is
 * where its feet go.
 */
export function Walker({
  avatar,
  width,
  home,
  floorLine,
  scale: s,
}: {
  avatar: Avatar;
  width: number;
  home: number;
  floorLine: number;
  scale: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const petEl = useRef<HTMLDivElement>(null);
  const moving = useMotion();
  const { stand, stride } = avatar.art;
  const pet = avatar.pet;

  useEffect(() => {
    const node = el.current;
    const petNode = petEl.current;
    if (!node) return;
    const min = 2;
    const max = Math.max(min, width - AVATAR_W - 2);
    const start = Math.min(Math.max(home, min), max);
    let x = start;
    let drawn = NaN;
    let facing: "left" | "right" = "left";

    // Where the pet goes: at the avatar's heels, behind whichever way it
    // faces, overlapping it a little.
    const petW = pet?.stand.w ?? 0;
    const heel = () =>
      Math.min(Math.max(facing === "right" ? x - petW + 3 : x + AVATAR_W - 3, 0), Math.max(0, width - petW));
    let px = heel();
    let petDrawn = NaN;
    let petFacing: "left" | "right" = facing;
    const drawPet = (walking: boolean) => {
      if (!petNode) return;
      const dot = Math.round(px);
      if (dot !== petDrawn) {
        petNode.style.transform = `translateX(${dot * s}px)`;
        petDrawn = dot;
      }
      petNode.dataset.facing = petFacing;
      petNode.toggleAttribute("data-walking", walking);
    };

    const draw = (walking: boolean) => {
      const dot = Math.round(x);
      if (dot !== drawn) {
        node.style.transform = `translateX(${dot * s}px)`;
        drawn = dot;
      }
      node.dataset.facing = facing;
      node.toggleAttribute("data-walking", walking);
    };
    draw(false);
    drawPet(false);
    if (!moving) return;

    const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    let target: number | null = null;
    let restUntil = performance.now() + between(1200, 3500);
    let turnAt: number | null = null;
    let last = performance.now();
    let frame = 0;
    const followPet = (dt: number) => {
      if (!petNode) return;
      const goal = heel();
      const gap = goal - px;
      if (Math.abs(gap) < 1) {
        // There: it faces the way the avatar does.
        if (petFacing !== facing || petNode.hasAttribute("data-walking")) {
          petFacing = facing;
          drawPet(false);
        }
        return;
      }
      const step = PET_SPEED * dt * Math.sign(gap);
      px = Math.abs(gap) <= Math.abs(step) ? goal : px + step;
      petFacing = gap > 0 ? "right" : "left";
      drawPet(true);
    };
    const tick = (now: number) => {
      // A tab in the background gets no frames; don't leap on return.
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (target === null) {
        if (turnAt !== null && now >= turnAt) {
          facing = facing === "left" ? "right" : "left";
          turnAt = null;
          draw(false);
        }
        if (now >= restUntil) {
          // Somewhere a fair walk away; a third of the time, back home.
          let next = Math.random() < 0.33 ? start : between(min, max);
          for (let i = 0; i < 4 && Math.abs(next - x) < 18; i++) next = between(min, max);
          if (Math.abs(next - x) >= 6) {
            target = next;
            facing = next > x ? "right" : "left";
            draw(true);
          } else restUntil = now + between(REST[0], REST[1]);
        }
      } else {
        const step = SPEED * dt * Math.sign(target - x);
        if (Math.abs(target - x) <= Math.abs(step)) {
          x = target;
          target = null;
          const rest = between(REST[0], REST[1]);
          restUntil = now + rest;
          // Sometimes it looks back the way it came; at home, at the fire.
          turnAt =
            x === start ? (facing === "right" ? now + 500 : null) : Math.random() < 0.4 ? now + rest * 0.5 : null;
          draw(false);
        } else {
          x += step;
          draw(true);
        }
      }
      followPet(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, width, home, s, pet]);

  return (
    <>
      {pet && (
        <div
          ref={petEl}
          className="room-abs room-pet room-pet-walker"
          aria-hidden="true"
          data-facing="left"
          style={{ left: 0, top: (floorLine - pet.stand.h) * s, width: pet.stand.w * s, height: pet.stand.h * s }}
        >
          <Strider stand={pet.stand} stride={pet.stride} />
        </div>
      )}
      <div
        ref={el}
        className="room-abs room-avatar room-walker"
        aria-hidden="true"
        data-facing="left"
        style={{ left: 0, top: (floorLine - stand.h) * s, width: stand.w * s, height: stand.h * s, ...avatar.colours }}
      >
        <Strider stand={stand} stride={stride} />
      </div>
    </>
  );
}

/** The pet curled up asleep, its right edge at `right` (in dots) on the
 *  floor at `floorLine`. */
export function SleepingPet({
  pet,
  right,
  floorLine,
  scale: s,
}: {
  pet: PetArt;
  right: number;
  floorLine: number;
  scale: number;
}) {
  return (
    <Sprite
      art={pet.curl}
      scale={s}
      className="room-abs room-pet"
      style={{ left: (right - pet.curl.w) * s, top: (floorLine - pet.curl.h) * s }}
    />
  );
}

/** The avatar in the armchair with the book being read: `x`/`y` are the
 *  sprite's top left, in dots. */
export function SeatedAvatar({
  avatar,
  x,
  y,
  spine,
  scale: s,
}: {
  avatar: Avatar;
  x: number;
  y: number;
  spine: string;
  scale: number;
}) {
  return (
    <Sprite
      art={avatar.art.sit}
      scale={s}
      className="room-abs room-avatar"
      style={{ left: x * s, top: y * s, ...avatar.colours, "--spine": spine } as React.CSSProperties}
    />
  );
}

/** The avatar on its own, for the avatar maker: standing, walking on the
 *  spot if motion is allowed, or in the armchair. */
export function AvatarPortrait({
  avatar,
  pose,
  scale = 4,
  walking = false,
}: {
  avatar: Avatar;
  pose: "stand" | "sit";
  scale?: number;
  walking?: boolean;
}) {
  const moving = useMotion() && walking;
  const a = pose === "sit" ? avatar.art.sit : avatar.art.stand;
  const pet = pose === "stand" ? avatar.pet : null;
  return (
    <div className="flex items-end">
      {pet && (
        <div
          className="room-pet"
          data-facing="right"
          data-walking={moving ? "" : undefined}
          style={{ width: pet.stand.w * scale, height: pet.stand.h * scale, marginRight: -3 * scale }}
        >
          <Strider stand={pet.stand} stride={pet.stride} />
        </div>
      )}
      <div
        className="room-avatar"
        data-facing="right"
        data-walking={moving ? "" : undefined}
        style={{ ...avatar.colours, "--spine": "#7a3b4a" } as React.CSSProperties}
      >
        <svg
          width={a.w * scale}
          height={a.h * scale}
          viewBox={`0 0 ${a.w} ${a.h}`}
          shapeRendering="crispEdges"
          className="block"
          aria-hidden="true"
          focusable="false"
        >
          {pose === "sit" ? (
            <Rects rects={a.rects} />
          ) : (
            <>
              <Rects className="room-walk-stand" rects={avatar.art.stand.rects} />
              <Rects className="room-walk-stride" rects={avatar.art.stride.rects} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
