"use client";

import { useEffect } from "react";
import { motionAllowed } from "@/lib/motion";

/**
 * Ink stats: the big numbers on Stats (`.ink-number`, the Ink wrapper in
 * components/stat-blocks.tsx) write themselves in like ink from a pen
 * (globals.css, "Ink stats"). The ones on screen as the page opens do that
 * from CSS alone, so they never wait for this script. This holds back the
 * ones further down, out of sight, until they scroll into view, and writes
 * those that come into view together one after another.
 *
 * Nothing with "Big numbers" set to simply show (`data-ink-stats="off"`)
 * or with animations off.
 */
export function InkWatcher() {
  useEffect(() => {
    if (document.documentElement.dataset.inkStats !== "on" || !motionAllowed()) return;
    const waiting = [...document.querySelectorAll<HTMLElement>(".ink-number")].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    if (waiting.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.style.setProperty("--ink-delay", `${step++ * 0.12}s`);
          // Back to the rule that writes it, from the start.
          delete el.dataset.inkWait;
        }
      },
      // Once a little of it is past the foot of the screen.
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of waiting) {
      el.dataset.inkWait = "";
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const el of waiting) delete el.dataset.inkWait;
    };
  }, []);
  return null;
}
