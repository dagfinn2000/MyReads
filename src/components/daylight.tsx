"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SCENE_BACKGROUNDS, SCENE_THEMES, daylightAt, daylightStyle } from "@/lib/daylight";

/**
 * The light of the time of day (lib/daylight.ts) on the scenes behind the
 * pages and in the reading room: warm around sunrise and sunset, dim at
 * night. The root layout works out the light for the moment it renders
 * and puts it on <html> (`data-daylight` and --dl-warm, --dl-night), so the
 * first paint is right; this keeps it going, once a minute and whenever the
 * tab comes back.
 *
 * Over a scene it lays a wash between the scene and the page (globals.css,
 * "Time of day"): a warm glow low in the window, and at night the dark
 * drawing in from the edges, kept off the middle where the page's own words
 * are. Only over a scene: the moving backgrounds (not Sky, which already
 * shows the time of day) and the themes under Scenes. The reading room
 * takes the light from the same properties in CSS.
 */

const subscribe = (fn: () => void) => {
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-background", "data-own-background", "data-theme"],
  });
  return () => observer.disconnect();
};
const overScene = () => {
  const root = document.documentElement;
  if (root.hasAttribute("data-own-background")) return SCENE_THEMES.has(root.dataset.theme ?? "");
  return SCENE_BACKGROUNDS.has(root.dataset.background ?? "");
};

export function Daylight({ timeZone, scene }: { timeZone: string; scene: boolean }) {
  const shows = useSyncExternalStore(subscribe, overScene, () => scene);

  useEffect(() => {
    const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const root = document.documentElement;
    const update = () => {
      const light = daylightAt(new Date(), zone);
      root.dataset.daylight = light.phase;
      for (const [name, value] of Object.entries(daylightStyle(light))) root.style.setProperty(name, value);
    };
    update();
    // Once a minute is plenty: the light changes over the better part of
    // an hour.
    const timer = setInterval(update, 60_000);
    const onShow = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [timeZone]);

  return shows ? <div className="daylight" aria-hidden="true" /> : null;
}
