"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { motionAllowed } from "@/lib/motion";

/**
 * Cards that glide to their new places: when the library is sorted or
 * filtered, or the quotes are shuffled, a card that was showing before and
 * still is slides from where it was to where it now sits, instead of
 * jumping there (FLIP: first, last, invert, play). Cards new to the page
 * rise in as they always have (lib/card-cascade.ts), and a card that goes
 * simply goes.
 *
 * Each card carries `data-glide` with a key of its own (and
 * `data-glide-inner` when only what's inside it should move, as on the
 * bookshelf, where the board under a book stays put). After every change
 * of `order` the hook measures each card's place in the container, and
 * slides the ones that moved from their old place to the new one with a
 * transform that Web Animations runs off the main thread. Places are kept
 * relative to the container, so scrolling or the filters above growing a
 * row never count as moving. Only a card on screen both before and after
 * glides: one coming from far off rises into its place like a new card,
 * one going far off simply goes, and the rest just take their places, so
 * nothing streaks across the page.
 *
 * Not when animations are off, nor with "Sorting and filtering" set to
 * straight away (data-card-glide="off" on <html>), nor while the page
 * crossfades or turns (lib/page-turn.ts), which moves the whole page
 * already. And not when `view` changes too (another card size, list or
 * grid), where the cards change shape as well as place.
 */

/** How long a glide takes, in ms: a little longer for a long way. */
export function glideDuration(distance: number): number {
  return Math.round(380 + Math.min(220, distance / 4));
}

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** How far off screen a card may be and still glide, in px. */
const MARGIN = 160;

export function glideAllowed(): boolean {
  if (!motionAllowed()) return false;
  const html = document.documentElement;
  if (html.dataset.cardGlide === "off") return false;
  return !["tab-fade", "page-fade", "page-turn"].some((c) => html.classList.contains(c));
}

type Spot = { x: number; y: number };

/** The translation a computed transform moves a box by. */
function translation(el: Element | null): Spot {
  const transform = el ? getComputedStyle(el).transform : "none";
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(transform);
  return { x: m.m41, y: m.m42 };
}

/** What moves when a card glides: the card, or what's inside it. */
function mover(cell: HTMLElement): HTMLElement | null {
  return cell.hasAttribute("data-glide-inner") ? (cell.firstElementChild as HTMLElement | null) : cell;
}

/** How far a card is drawn from where it sits: its rise, and a glide
 *  still under way. */
function movedBy(cell: HTMLElement): Spot {
  const own = translation(cell);
  const inner = mover(cell);
  if (inner === cell) return own;
  const more = translation(inner);
  return { x: own.x + more.x, y: own.y + more.y };
}

/** Where a card sits in the container, however it's drawn just now. */
function spotOf(cell: HTMLElement, origin: DOMRect): Spot {
  const box = cell.getBoundingClientRect();
  const moved = movedBy(cell);
  return { x: box.left - origin.left - moved.x, y: box.top - origin.top - moved.y };
}

export function useGlide(
  ref: RefObject<HTMLElement | null>,
  order: unknown,
  view: string,
) {
  const last = useRef<{ view: string; spots: Map<string, Spot> } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const before = last.current;
    const glide = !!before && before.view === view && glideAllowed();
    const cells = [...root.querySelectorAll<HTMLElement>("[data-glide]")];

    // React moves a kept card's node to put it in its new place, which
    // starts its rise (.card-in) over again; it was showing, so it stays.
    if (glide) {
      for (const el of cells) {
        if (!before.spots.has(el.dataset.glide!)) continue;
        for (const a of el.getAnimations()) {
          if (a instanceof CSSAnimation && a.animationName === "card-in") a.finish();
        }
      }
    }

    const origin = root.getBoundingClientRect();
    const spots = new Map<string, Spot>();
    // Each move's card, how far it has to go, and where it now sits on
    // screen (its top and height).
    const moves: { el: HTMLElement; from: Spot; top: number; height: number; to: number }[] = [];
    for (const el of cells) {
      const key = el.dataset.glide!;
      const box = el.getBoundingClientRect();
      // Where it is drawn now, less whatever is moving it (a glide still
      // under way, or its rise), is where it sits.
      const moved = movedBy(el);
      const spot = { x: box.left - origin.left - moved.x, y: box.top - origin.top - moved.y };
      spots.set(key, spot);
      const was = glide ? before.spots.get(key) : undefined;
      if (!was) continue;
      // It was drawn at its old place plus that same movement.
      const from = { x: was.x + moved.x - spot.x, y: was.y + moved.y - spot.y };
      if (Math.abs(from.x) < 1 && Math.abs(from.y) < 1) continue;
      moves.push({ el, from, top: origin.top + spot.y, height: box.height, to: Math.hypot(from.x, from.y) });
    }
    last.current = { view, spots };

    const seen = (top: number, height: number) =>
      top + height > -MARGIN && top < window.innerHeight + MARGIN;
    for (const { el, from, top, height, to } of moves) {
      const target = mover(el);
      if (!target) continue;
      for (const a of target.getAnimations()) if (a.id === "glide") a.cancel();
      const wasSeen = seen(top + from.y, height);
      const isSeen = seen(top, height);
      if (wasSeen && isSeen) {
        target.animate(
          [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: "none" }],
          { id: "glide", duration: glideDuration(to), easing: EASING },
        );
      } else if (isSeen) {
        target.animate(
          [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
          { id: "glide", duration: 450, delay: 120, easing: EASING, fill: "backwards" },
        );
      }
    }
  }, [ref, order, view]);

  // The container changing size (a narrower window, a card drawn taller)
  // moves cards without any change of order: take their new places as
  // where they are, so the next change glides from there.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const kept = last.current;
        if (!kept) return;
        const origin = root.getBoundingClientRect();
        const spots = new Map<string, Spot>();
        for (const el of root.querySelectorAll<HTMLElement>("[data-glide]")) {
          spots.set(el.dataset.glide!, spotOf(el, origin));
        }
        last.current = { view: kept.view, spots };
      });
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);
}
