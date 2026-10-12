"use client";

import { useEffect, useRef } from "react";
import { celebrate } from "@/lib/confetti";

/**
 * Wraps the gold medal on the stats page. The first time this browser sees
 * a year's goal reached, confetti bursts from the medal; after that the
 * medal just shines, so the stats page doesn't throw a party on every visit.
 */
export function GoalReached({ year, children }: { year: number; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const key = `myreads-goal-celebrated-${year}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // No storage (some private modes): skip the confetti rather than
      // repeat it on every visit.
      return;
    }
    // After the medal has swung in (globals.css). Marked as seen only once
    // it actually plays, so a page left within the delay still gets it.
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, "1");
      } catch {}
      celebrate(ref.current?.firstElementChild);
    }, 450);
    return () => clearTimeout(timer);
  }, [year]);

  return (
    // `contents`: no box of its own, so the medal lays out as before; the
    // burst starts from the medal itself.
    <span ref={ref} className="contents">
      {children}
    </span>
  );
}
