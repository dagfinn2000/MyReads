/**
 * A big number on Stats, which writes itself in like ink from a pen as it
 * comes into view (globals.css "Ink stats", components/ink-stats.tsx), or
 * simply shows with that turned off in Preferences or animations off.
 * `chars` is roughly how long it is, for how long the pen takes; a string
 * child counts itself.
 */
export function Ink({ chars, children }: { chars?: number; children: React.ReactNode }) {
  const length =
    chars ?? (typeof children === "string" || typeof children === "number" ? String(children).length : 3);
  return (
    <span className="ink-number" style={{ "--ink-len": Math.min(length, 10) } as React.CSSProperties}>
      {children}
    </span>
  );
}
