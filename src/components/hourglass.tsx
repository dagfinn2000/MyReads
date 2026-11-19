"use client";

import { useId, useState } from "react";
import { hourglassAt } from "@/lib/hourglass";

// The glass, in the drawing's units (12 by 16): its bulbs meet at the neck.
const NECK = 8;
const TOP = 1.9;
const BASE = 14.1;
const GLASS = `M2.6 ${TOP}C2.6 5.2 5.3 6.7 5.3 ${NECK}C5.3 9.3 2.6 10.8 2.6 ${BASE}H9.4C9.4 10.8 6.7 9.3 6.7 ${NECK}C6.7 6.7 9.4 5.2 9.4 ${TOP}Z`;
/** How far below the neck the sand starts in a full glass. */
const FULL = 4.8;
/** The share of the lower bulb a glass's sand fills. */
const FILLS = (FULL / (BASE - NECK)) ** 2;

/**
 * The reading timer's hourglass (Preferences › Motion › Reading timer), in
 * place of the dot: a quarter-hour glass whose sand runs from the top bulb
 * into the bottom one as you read, a thin stream of it falling through the
 * neck while the timer runs, and that turns itself over at each quarter
 * hour to run again (lib/hourglass.ts). The sand stands still while the
 * timer is paused.
 *
 * The bulbs narrow to the neck, so the sand above falls slowly at first and
 * quickly at the end, and the pile below rises quickly at first, as in a
 * real glass (each a cone's volume). The levels move once a second with the
 * clock; the falling grains and the turning over are composited, and both
 * stop with animations off (the glass simply shows the next quarter's sand).
 */
export function Hourglass({ elapsedMs, running }: { elapsedMs: number; running: boolean }) {
  const { turn, run } = hourglassAt(elapsedMs);
  // A glass is only seen turning over when it happens on screen.
  const [firstTurn] = useState(turn);
  // An id url() takes as it is (useId's own has marks it would need escaped).
  const clip = `hourglass${useId().replace(/[^\w-]/g, "")}-${turn}`;
  // The top of the sand above, and of the pile below.
  const above = NECK - FULL * Math.sqrt(1 - run);
  const pile = (BASE - NECK) * (1 - Math.sqrt(1 - FILLS * run));
  const below = BASE - pile;
  const mound = Math.min(0.7, pile / 2);
  const falling = running && run < 1;
  return (
    <span
      key={turn}
      aria-hidden="true"
      className="hourglass"
      data-turned={turn > firstTurn ? "" : undefined}
      data-running={running ? "" : undefined}
    >
      <svg viewBox="0 0 12 16">
        <defs>
          <clipPath id={clip}>
            <path d={GLASS} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`} className="hourglass-sand">
          <rect x="0" y={above} width="12" height={Math.max(0, NECK - above)} />
          {pile > 0.05 && (
            <path
              d={`M0 16V${below + mound}Q6 ${below - mound} 12 ${below + mound}V16Z`}
            />
          )}
        </g>
        <path d={GLASS} className="hourglass-glass" />
        <rect x="1.4" y="0.8" width="9.2" height="1.25" rx="0.55" className="hourglass-cap" />
        <rect x="1.4" y="13.95" width="9.2" height="1.25" rx="0.55" className="hourglass-cap" />
      </svg>
      {falling && (
        <span
          className="hourglass-stream"
          style={{
            top: `${(NECK / 16) * 100}%`,
            height: `${((below - mound * 0.6 - NECK) / 16) * 100}%`,
          }}
        >
          <span />
        </span>
      )}
    </span>
  );
}
