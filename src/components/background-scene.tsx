"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { skyAt, skyStyle } from "@/lib/sky";

/**
 * What lies and moves behind the pages for the backgrounds that are
 * scenes: rain, snow and stars, drifting aurora, ripples on the pond, and
 * the Sky background's colours through the day. One fixed layer under
 * everything, drawn by globals.css ("Moving backgrounds").
 *
 * Rain, snow and stars are scattered across the whole window rather than
 * repeated on a small tile, so nothing lines up in rows: the far-off marks
 * are two layers of tiles whose sizes share no factor, and the near ones
 * (big drops and flakes, bright stars) are each their own element, at
 * their own place and pace. The scatter comes from a seeded random number
 * generator, so the server and the browser draw the same one.
 *
 * Whether anything moves is decided in CSS, by the same rules as every
 * other animation (Animations, reduced motion) plus "Moving backgrounds" in
 * Preferences. While it can't, rain, snow and stars hold still where they
 * are, and aurora and ripples give way to their still textures. The sky's
 * colours are the time of day rather than motion, so they always show. The
 * server works out the sky for the moment it renders, so the first paint is
 * right; from then on it is updated here.
 *
 * The background is read from <html> rather than taken as a prop alone, so
 * a change in Preferences (which sets the attribute at once) shows here
 * straight away too.
 */

const subscribe = (fn: () => void) => {
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-background"],
  });
  return () => observer.disconnect();
};
const readBackground = () => document.documentElement.dataset.background ?? "plain";

/** Raindrops on the pond: where each lands, how often, and when first. */
const DROPS = [
  { x: 14, y: 22, t: 11, d: -2 },
  { x: 72, y: 14, t: 13, d: -7 },
  { x: 38, y: 58, t: 9.5, d: -4 },
  { x: 88, y: 46, t: 12, d: -10 },
  { x: 24, y: 84, t: 14, d: -1 },
  { x: 60, y: 78, t: 10.5, d: -8 },
  { x: 50, y: 34, t: 15, d: -12 },
];

/** Mulberry32: a small seeded generator, the same on every machine. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` places across the window, as percentages, each the best of a
 * few random tries at keeping away from the ones before. That spreads them
 * evenly without a grid, and any run from the start of the list is spread
 * evenly too, which matters because small screens show only some of them.
 */
function scatter(rand: () => number, count: number, tries = 10) {
  const points: { x: number; y: number }[] = [];
  for (let n = 0; n < count; n++) {
    let best = { x: 0, y: 0 };
    let far = -1;
    for (let i = 0; i < tries; i++) {
      const p = { x: rand() * 100, y: rand() * 100 };
      const d = Math.min(Infinity, ...points.map((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2));
      if (d > far) [best, far] = [p, d];
    }
    points.push(best);
  }
  return points;
}

const between = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);
const fixed = (n: number, digits = 2) => n.toFixed(digits);
const style = (vars: Record<string, string | number>) => vars as React.CSSProperties;

/** The nearer raindrops: each its own length, speed and place in its fall
 *  (--p, from 0 at the top of the window to 1 below the bottom). */
const RAIN = (() => {
  const rand = seeded(7);
  return scatter(rand, 90).map(({ x }) =>
    style({
      left: `${fixed(x)}%`,
      height: `${fixed(between(rand, 12, 21), 1)}px`,
      opacity: fixed(between(rand, 0.55, 1)),
      "--t": `${fixed(between(rand, 5.2, 6.6))}s`,
      "--p": fixed(rand(), 3),
    }),
  );
})();

/** The nearer snowflakes, falling and swaying each at their own pace. */
const SNOW = (() => {
  const rand = seeded(19);
  return scatter(rand, 42).map(({ x }) =>
    style({
      left: `${fixed(x)}%`,
      "--size": `${fixed(between(rand, 4, 7), 1)}px`,
      opacity: fixed(between(rand, 0.7, 1)),
      "--t": `${fixed(between(rand, 26, 38), 1)}s`,
      "--p": fixed(rand(), 3),
      "--sway": `${fixed(between(rand, 10, 24), 1)}px`,
      "--s": `${fixed(between(rand, 5, 11), 1)}s`,
      "--sp": fixed(rand(), 3),
    }),
  );
})();

/** The brighter stars, which twinkle, each on its own beat; a few of them
 *  glint. --o is how bright each one is while nothing may move. */
const STARS = (() => {
  const rand = seeded(31);
  return scatter(rand, 52).map(({ x, y }, i) => ({
    glint: i % 7 === 3,
    style: style({
      left: `${fixed(x)}%`,
      top: `${fixed(y)}%`,
      "--size": `${fixed(i % 7 === 3 ? between(rand, 9, 13) : between(rand, 2.2, 3.4), 1)}px`,
      "--o": fixed(between(rand, 0.4, 0.9)),
      "--t": `${fixed(between(rand, 3, 9), 1)}s`,
      "--p": fixed(rand(), 3),
    }),
  }));
})();

export function BackgroundScene({
  background,
  timeZone,
  sky: initialSky,
}: {
  /** The saved background, for the server's render. */
  background: string;
  /** The reader's zone from Preferences; empty = the browser's own. */
  timeZone: string;
  /** The sky as the server worked it out, so the first paint is right. */
  sky?: Record<string, string>;
}) {
  const current = useSyncExternalStore(subscribe, readBackground, () => background);
  const [sky, setSky] = useState(initialSky);

  useEffect(() => {
    if (current !== "sky") return;
    const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const update = () => setSky(skyStyle(skyAt(new Date(), zone)));
    update();
    // Once a minute is plenty: nothing in the sky changes faster.
    const timer = setInterval(update, 60_000);
    // A tab coming back after hours in the background catches up at once.
    const onShow = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [current, timeZone]);

  switch (current) {
    case "rain":
      return (
        <div className="bg-scene" data-scene="rain" aria-hidden="true">
          <i className="bg-rain-far-a" />
          <i className="bg-rain-far-b" />
          <b className="bg-many bg-rain-near">
            {RAIN.map((s, i) => (
              <i key={i} className="bg-raindrop" style={s} />
            ))}
          </b>
        </div>
      );
    case "snow":
      return (
        <div className="bg-scene" data-scene="snow" aria-hidden="true">
          {(["far-a", "far-b", "mid-a", "mid-b"] as const).map((layer) => (
            <b key={layer} className={`bg-sway bg-sway-${layer}`}>
              <i className={`bg-snow-${layer}`} />
            </b>
          ))}
          <b className="bg-many bg-snow-near">
            {SNOW.map((s, i) => (
              <i key={i} className="bg-flake" style={s} />
            ))}
          </b>
        </div>
      );
    case "stars":
      return (
        <div className="bg-scene" data-scene="stars" aria-hidden="true">
          <Stars />
          <ShootingStars count={3} />
        </div>
      );
    case "aurora":
      return (
        <div className="bg-scene" data-scene="aurora" aria-hidden="true">
          <i className="bg-aurora-1" />
          <i className="bg-aurora-2" />
          <i className="bg-aurora-3" />
        </div>
      );
    case "ripples":
      return (
        <div className="bg-scene" data-scene="ripples" aria-hidden="true">
          {DROPS.map((d) => (
            <i
              key={`${d.x}-${d.y}`}
              className="bg-drop"
              style={style({ left: `${d.x}%`, top: `${d.y}%`, "--t": `${d.t}s`, "--d": `${d.d}s` })}
            />
          ))}
        </div>
      );
    case "sky":
      return (
        <div className="bg-scene" data-scene="sky" aria-hidden="true" style={sky}>
          {/* Everything that only comes out at night, faded in by
              --sky-stars. */}
          <i className="bg-sky-night">
            <Stars />
            <ShootingStars count={1} />
          </i>
        </div>
      );
    default:
      return null;
  }
}

/** The still field of faint stars, and the brighter ones over it. */
function Stars() {
  return (
    <>
      <i className="bg-starfield" />
      <b className="bg-many bg-bright-stars">
        {STARS.map((s, i) => (
          <i key={i} className={s.glint ? "bg-glint" : "bg-twinkle"} style={s.style} />
        ))}
      </b>
    </>
  );
}

/**
 * Now and then a shooting star, at night (dark themes). Each one waits out
 * most of its loop unseen, and in that time moves to a new, random part of
 * the sky, so they never streak along the same path twice running.
 */
function ShootingStars({ count }: { count: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const move = (e: AnimationEvent) => {
      const star = e.target as HTMLElement;
      star.style.left = `${(20 + Math.random() * 75).toFixed(1)}%`;
      star.style.top = `${(4 + Math.random() * 40).toFixed(1)}%`;
      star.style.setProperty("--angle", `${(146 + Math.random() * 18).toFixed(1)}deg`);
    };
    box.addEventListener("animationiteration", move);
    return () => box.removeEventListener("animationiteration", move);
  }, []);
  return (
    <b ref={ref} className="bg-meteors">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={`bg-meteor bg-meteor-${i + 1}`} />
      ))}
    </b>
  );
}
