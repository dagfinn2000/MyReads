/**
 * Whether an animation started from script may play: the reader hasn't
 * turned Animations off in Preferences (`data-motion="off"` on <html>, set by
 * the root layout) and the device doesn't ask for reduced motion.
 *
 * CSS animations follow the same two rules through globals.css; this is for
 * the ones CSS can't reach — view transitions and the confetti canvas.
 */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "off") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
