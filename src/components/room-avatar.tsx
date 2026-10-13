"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { AVATAR_W, avatarArt, type AvatarArt } from "@/components/avatar-art";
import { Rects, Sprite } from "@/components/room-art";
import { HAIR_SWATCHES, LEGS_SWATCHES, SKIN_SWATCHES, TOP_SWATCHES, type AvatarLook } from "@/lib/avatar";
import { motionAllowed, subscribeMotion } from "@/lib/motion";

/** The avatar's art and the colours it's painted in, drawn once per look. */
export interface Avatar {
  art: AvatarArt;
  colours: React.CSSProperties;
}

export function useAvatar(look: AvatarLook | null): Avatar | null {
  return useMemo(() => (look ? { art: avatarArt(look), colours: avatarColours(look) } : null), [look]);
}

export function avatarColours(look: AvatarLook): React.CSSProperties {
  return {
    "--av-skin": SKIN_SWATCHES[look.skin],
    "--av-hair": HAIR_SWATCHES[look.hairColour],
    "--av-top": TOP_SWATCHES[look.top],
    "--av-legs": LEGS_SWATCHES[look.legs],
  } as React.CSSProperties;
}

const useMotion = () => useSyncExternalStore(subscribeMotion, motionAllowed, () => false);

/** Dots a second. */
const SPEED = 14;
/** How long it stands about between walks, in ms. */
const REST = [2500, 6500];

/**
 * The avatar pottering about a floor of the house while no book is being
 * read: it walks somewhere, stands a while, looks about, and now and then
 * comes back to stand by the fire. It moves a whole dot at a time, like
 * the rest of the room. With Animations off, or reduced motion, it just
 * stands by the fire.
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
  const moving = useMotion();
  const { stand, stride } = avatar.art;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const min = 2;
    const max = Math.max(min, width - AVATAR_W - 2);
    const start = Math.min(Math.max(home, min), max);
    let x = start;
    let drawn = NaN;
    let facing: "left" | "right" = "left";
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
    if (!moving) return;

    const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    let target: number | null = null;
    let restUntil = performance.now() + between(1200, 3500);
    let turnAt: number | null = null;
    let last = performance.now();
    let frame = 0;
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
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, width, home, s]);

  return (
    <div
      ref={el}
      className="room-abs room-avatar room-walker"
      aria-hidden="true"
      data-facing="left"
      style={{ left: 0, top: (floorLine - stand.h) * s, ...avatar.colours }}
    >
      <svg
        width={stand.w * s}
        height={stand.h * s}
        viewBox={`0 0 ${stand.w} ${stand.h}`}
        shapeRendering="crispEdges"
        className="block"
        focusable="false"
      >
        <Rects className="room-walk-stand" rects={stand.rects} />
        <Rects className="room-walk-stride" rects={stride.rects} />
      </svg>
    </div>
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
  return (
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
  );
}
