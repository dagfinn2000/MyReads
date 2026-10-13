"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { skyAt, skyStyle } from "@/lib/sky";

/**
 * What moves behind the pages: falling rain and snow, twinkling stars and
 * the odd shooting star, drifting aurora, ripples on the pond, and the Sky
 * background's colours through the day. One fixed layer under everything,
 * drawn by globals.css ("Moving backgrounds").
 *
 * Whether anything moves is decided in CSS, by the same rules as every
 * other animation (Animations, reduced motion) plus "Moving backgrounds" in
 * Preferences. While it can't, the scene is hidden and the page keeps the
 * still texture. The sky is the exception: its colours are the time of day
 * rather than motion, so they always show, and only its stars twinkle.
 * The server works out the sky for the moment it renders, so the first
 * paint is right; from then on it is updated here.
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

const style = (vars: Record<string, string | number>) => vars as React.CSSProperties;

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
          <i className="bg-rain-far" />
          <i className="bg-rain-near" />
        </div>
      );
    case "snow":
      return (
        <div className="bg-scene" data-scene="snow" aria-hidden="true">
          {(["far", "mid", "near"] as const).map((depth) => (
            <b key={depth} className={`bg-sway bg-sway-${depth}`}>
              <i className={`bg-snow-${depth}`} />
            </b>
          ))}
        </div>
      );
    case "stars":
      return (
        <div className="bg-scene" data-scene="stars" aria-hidden="true">
          <Twinkles />
          <i className="bg-meteor bg-meteor-1" />
          <i className="bg-meteor bg-meteor-2" />
          <i className="bg-meteor bg-meteor-3" />
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
            <i className="bg-sky-stars" />
            <Twinkles />
            <i className="bg-meteor bg-meteor-1" />
          </i>
        </div>
      );
    default:
      return null;
  }
}

function Twinkles() {
  return (
    <>
      <i className="bg-twinkle bg-twinkle-0" />
      <i className="bg-twinkle bg-twinkle-1" />
      <i className="bg-twinkle bg-twinkle-2" />
      <i className="bg-twinkle bg-twinkle-3" />
    </>
  );
}
