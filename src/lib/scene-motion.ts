/**
 * Keeps the moving backgrounds (components/background-scene.tsx) cheap to
 * run. Their animations are written in CSS (globals.css, "Moving
 * backgrounds"), which also decides when they may play; once each one is
 * running, this hands it over to a Web Animation that carries on from
 * exactly the same place, with the same keyframes and timing.
 *
 * Two things make that cheaper while it looks the same:
 *
 * - A CSS animation announces every time it loops, and because React
 *   listens for that on every page, the browser wakes the page's main
 *   thread to deliver it. With ninety raindrops on five- to seven-second
 *   loops that is a dozen or more times a second, each time restyling the
 *   page. A Web Animation loops without announcing it, so it runs on the
 *   compositor alone and the main thread stays asleep.
 * - Slow changes (stars twinkling, the aurora drifting) change in steps a
 *   few times a second, all on the same beat, instead of a little every
 *   frame. Between beats nothing changes, so the browser doesn't redraw
 *   the screen. A star brightening over a second or two in twenty steps a
 *   second looks the same as in sixty.
 *
 * CSS stays in charge of whether anything moves: when Animations or Moving
 * backgrounds is turned off, the device asks for reduced motion, or a
 * smaller window hides some of the drops, CSS stops animating those
 * elements and the stand-ins are dropped with them. When CSS starts
 * animating again, the new animations are handed over in turn.
 */

/** How often each slow animation changes, in milliseconds, by the name of
 *  its CSS keyframes. */
const BEATS: Record<string, number> = {
  // A star brightens or dims over one to five seconds.
  "bg-twinkle": 50,
  "bg-glint": 50,
  // The aurora drifts a few pixels a second, so under a pixel a step.
  "bg-drift": 100,
};

/** Left with CSS: a shooting star moves somewhere new each time it loops,
 *  which needs the announcement, and it loops only about once a minute.
 *  The pond's ripples (rings drawn by ::before and ::after) stay too: they
 *  loop every ten seconds or so, which costs little, and Chrome can leave
 *  a script animation on a pseudo-element drawn as it was once it stops. */
const LEFT_WITH_CSS = new Set(["bg-meteor"]);

/**
 * Puts a slow animation on a shared beat of `step` milliseconds: its
 * length, delay and start are rounded to whole steps (moving it by at most
 * half a step), and it eases in steps. Every animation on the same beat
 * then changes on the same ticks.
 */
export function onBeat(duration: number, delay: number, startTime: number, step: number) {
  const steps = Math.max(1, Math.round(duration / step));
  return {
    duration: steps * step,
    delay: Math.round(delay / step) * step,
    easing: `steps(${steps}, end)`,
    startTime: Math.round(startTime / step) * step,
  };
}

interface Taken {
  /** The CSS animation the stand-in took over from. */
  css: CSSAnimation;
  name: string;
  start: number;
}

/**
 * Hands over the animations of whatever scene `scene` returns. Call `sync`
 * after the scene's contents change; changes to motion settings and the
 * window's size are picked up by themselves. `stop` hands everything back
 * to CSS.
 */
export function handOverSceneMotion(scene: () => HTMLElement | null) {
  const taken = new Map<Animation, Taken>();
  let frame = 0;

  /** Whether CSS still animates the stand-in's element with its keyframes,
   *  and the element is drawn at all. */
  const wanted = (copy: Animation, name: string) => {
    const { target } = copy.effect as KeyframeEffect;
    if (!target?.isConnected || target.getClientRects().length === 0) return false;
    return getComputedStyle(target).animationName.split(", ").includes(name);
  };

  const take = (css: CSSAnimation) => {
    const effect = css.effect as KeyframeEffect;
    const name = css.animationName;
    const start = css.startTime as number;
    const timing = effect.getTiming();
    let startTime = start;
    const beat = BEATS[name];
    if (beat) {
      const b = onBeat(Number(timing.duration), timing.delay ?? 0, start, beat);
      Object.assign(timing, { duration: b.duration, delay: b.delay, easing: b.easing });
      startTime = b.startTime;
    }
    const copy = new Animation(
      new KeyframeEffect(effect.target, effect.getKeyframes(), timing),
      document.timeline,
    );
    // A stand-in left over from before the element was last hidden.
    for (const [old, was] of taken) {
      if (was.name === name && (old.effect as KeyframeEffect).target === effect.target) {
        old.cancel();
        taken.delete(old);
      }
    }
    copy.startTime = startTime;
    taken.set(copy, { css, name, start });
    // A CSS animation cancelled from script stays cancelled until CSS
    // drops it and adds it again.
    css.cancel();
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const [copy, { name }] of taken) {
      if (wanted(copy, name)) continue;
      copy.cancel();
      taken.delete(copy);
    }
    for (const css of scene()?.getAnimations({ subtree: true }) ?? []) {
      if (!(css instanceof CSSAnimation) || css.playState !== "running") continue;
      if (LEFT_WITH_CSS.has(css.animationName) || (css.effect as KeyframeEffect).pseudoElement) continue;
      // Only just started: hand it over once it has a start time.
      if (css.startTime === null) {
        css.ready.then(schedule, () => {});
        continue;
      }
      try {
        take(css);
      } catch {
        // A browser that can't make the stand-in leaves it with CSS.
      }
    }
  };
  const schedule = () => {
    frame ||= requestAnimationFrame(sync);
  };

  const supported = typeof CSSAnimation !== "undefined" && typeof KeyframeEffect !== "undefined";
  const observer = new MutationObserver(schedule);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (supported) {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion", "data-background-motion"],
    });
    reduce.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
  }

  return {
    sync: supported ? sync : () => {},
    stop() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduce.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      for (const [copy, { css, name, start }] of taken) {
        copy.cancel();
        // Back to CSS, at the same place in its loop.
        if (wanted(copy, name)) {
          css.play();
          css.startTime = start;
        }
      }
      taken.clear();
    },
  };
}
