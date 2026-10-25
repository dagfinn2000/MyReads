"use client";

import { useEffect } from "react";
import { motionAllowed } from "@/lib/motion";

/** How far a cover turns at its edge, in degrees. */
const MAX_TILT = 8;

/**
 * Covers that follow the pointer: a cover marked `data-tilt` (the library's
 * covers and a book's own cover, components/book-card.tsx) leans back where
 * the pointer rests on it, as if pressed, and a soft light sits under the
 * pointer (globals.css, "Covers that follow the pointer").
 *
 * One listener for the whole page rather than one per cover, so a library
 * of a thousand books costs nothing until the pointer is over a cover. This
 * only writes the angles; CSS decides whether they show, so a mouse or
 * trackpad is needed, and Animations off, reduced motion or "Covers follow
 * the pointer: Off" (`data-cover-tilt`) keep every cover flat.
 */
export function CoverTilt() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let current: HTMLElement | null = null;
    let at: { x: number; y: number } | null = null;
    let frame = 0;

    const draw = () => {
      frame = 0;
      if (!current || !at) return;
      const rect = current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.min(1, Math.max(0, (at.x - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (at.y - rect.top) / rect.height));
      current.style.setProperty("--tilt-x", `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
      current.style.setProperty("--tilt-y", `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
      current.style.setProperty("--sheen-x", `${(x * 100).toFixed(1)}%`);
      current.style.setProperty("--sheen-y", `${(y * 100).toFixed(1)}%`);
    };

    /** Lets the cover ease back flat, or snaps it flat at once (when it's
     *  clicked, so it flies to the book's page square). */
    const release = (snap = false) => {
      const el = current;
      if (!el) return;
      current = null;
      at = null;
      if (snap) el.style.transition = "none";
      el.removeAttribute("data-tilting");
      for (const name of ["--tilt-x", "--tilt-y", "--sheen-x", "--sheen-y"]) el.style.removeProperty(name);
      if (snap) {
        void el.offsetWidth;
        el.style.removeProperty("transition");
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tilt]") : null;
      if (target !== current) {
        release();
        const on =
          fine.matches && motionAllowed() && document.documentElement.dataset.coverTilt !== "off";
        if (!target || !on) return;
        current = target;
        current.setAttribute("data-tilting", "");
      }
      at = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onOut = (e: PointerEvent) => {
      if (current && !(e.relatedTarget instanceof Node && current.contains(e.relatedTarget))) release();
    };
    const onDown = () => release(true);
    const onScroll = () => release();

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
      cancelAnimationFrame(frame);
      release(true);
    };
  }, []);

  return null;
}
