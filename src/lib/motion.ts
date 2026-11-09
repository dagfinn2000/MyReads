/**
 * Whether an animation started from script may play: the reader hasn't
 * turned Animations off in Preferences (`data-motion="off"` on <html>, set by
 * the root layout) and the device doesn't ask for reduced motion.
 *
 * CSS animations follow the same two rules through globals.css; this is for
 * the ones CSS can't reach — view transitions and the celebrations
 * canvas (lib/celebrate.ts).
 */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "off") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Calls `onChange` when either of motionAllowed's two rules changes;
 *  returns an unsubscribe. For useSyncExternalStore. */
export function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    query.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/** Shakes an element side to side once, the way a sign-in window says no
 *  to a wrong password: a few small swings that die away. Moves only
 *  `translate`, so it leaves the element's own transform alone, and does
 *  nothing when motion is off. */
export function shakeNo(element: HTMLElement | null): void {
  if (!element || typeof element.animate !== "function" || !motionAllowed()) return;
  element.animate(
    [
      { translate: "0 0", easing: "ease-out" },
      { translate: "-7px 0", offset: 0.14, easing: "ease-in-out" },
      { translate: "6px 0", offset: 0.36, easing: "ease-in-out" },
      { translate: "-4px 0", offset: 0.58, easing: "ease-in-out" },
      { translate: "2px 0", offset: 0.8, easing: "ease-in-out" },
      { translate: "0 0" },
    ],
    { duration: 450 },
  );
}
