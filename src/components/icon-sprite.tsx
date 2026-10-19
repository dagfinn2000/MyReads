/**
 * Icons a page repeats dozens or hundreds of times, drawn once per page.
 *
 * Every rating is ten star icons (an outline row with a filled row clipped
 * over it), and every book without a cover carries the plain cover's book
 * icon. As lucide's own <svg>s, each one repeated its whole path, and on the
 * library page those paths were a quarter of the HTML. Here the paths
 * are <symbol>s in one hidden <svg> that the root layout renders, and each
 * icon is an <svg> with lucide's exact attributes holding a <use> of its
 * symbol, so it draws exactly as before. icon-sprite.test.ts checks the paths
 * against lucide's.
 */

export const SPRITE_PATHS = {
  star: [
    "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  ],
  "book-open": [
    "M12 5v16",
    "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z",
  ],
} as const;

export type SpriteName = keyof typeof SPRITE_PATHS;

/** The symbols, once per page (app/layout.tsx). */
export function IconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      {Object.entries(SPRITE_PATHS).map(([name, paths]) => (
        <symbol key={name} id={`icon-${name}`} viewBox="0 0 24 24">
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </symbol>
      ))}
    </svg>
  );
}

/** A sprite icon, in place of lucide's component of the same name. */
export function SpriteIcon({ name, className }: { name: SpriteName; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["lucide", `lucide-${name}`, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <use href={`#icon-${name}`} />
    </svg>
  );
}
