import { motionAllowed } from "@/lib/motion";
import { isNavActive } from "@/lib/nav";

/**
 * Page turns: moving to another of the app's sections from the top bar (or
 * its keyboard shortcuts) turns the page like a book's. Going on to a link
 * further along the bar, the old page lifts at its right edge and turns
 * away over the left; going back, the new page turns in from the left and
 * settles over the old. The top bar stays where it is, like the binding.
 * See globals.css, "Page turns".
 *
 * Only between sections: opening a book or filtering the library stays on
 * its page (a cover flies to a book's page instead). Not when animations
 * are off or on a browser without view transitions, where pages fade up as
 * they open. With "Moving between pages" set to a crossfade in Preferences
 * the old page fades into the new one instead, and tabs within a page
 * (crossfadeTo) do the same, more quickly.
 */

export type TurnDirection = "on" | "back";

/** How long to hold the old page for the new one itself. Past this it
 *  turns to the new page's loading skeleton if that's what is there, rather
 *  than leave a click unanswered. */
const SKELETON_AFTER_MS = 500;
/** And past this, to whatever is there at all. */
const WAIT_LIMIT_MS = 1200;

/** True while a page is turning: another click then simply goes. */
let turning = false;

/** Which way the page turns going from `pathname` to `href`, given the top
 *  bar's links in order: on to a link further along the bar (or from a page
 *  that isn't on it, like Account), back to one before, and null when
 *  `href` is in the section already open, so there's no page to turn. */
export function pageTurnDirection(
  links: readonly string[],
  pathname: string,
  href: string,
): TurnDirection | null {
  if (isNavActive(href, pathname)) return null;
  const from = links.findIndex((link) => isNavActive(link, pathname));
  const to = links.indexOf(href);
  return from >= 0 && to >= 0 && to < from ? "back" : "on";
}

/**
 * Goes to `href` (by calling `navigate`) with the page turning, or with
 * the old page crossfading into the new one when "Moving between pages" is
 * set to a crossfade, and returns true; or returns false without doing
 * anything when nothing should move, for the caller to navigate as usual.
 *
 * The browser snapshots the page as it is and holds that picture while
 * `navigate` runs. Once the new page is in, past its loading skeleton, the
 * old picture turns away to show it (or it turns in over the old, or the
 * two fade into each other).
 */
export function turnPage(href: string, navigate: () => void): boolean {
  if (!canMove()) return false;
  const html = document.documentElement;
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".top-bar a.nav-link")].map(
    (a) => a.getAttribute("href") ?? "",
  );
  const direction = pageTurnDirection(links, window.location.pathname, href);
  if (!direction) return false;
  const classes =
    html.dataset.pageChange === "fade" ? ["page-fade"] : ["page-turn", `page-turn-${direction}`];
  hold(href, navigate, classes, { skeletonAfter: SKELETON_AFTER_MS, limit: WAIT_LIMIT_MS, exact: false });
  return true;
}

/** How long a tab holds its old look for the new one. Moving within a page
 *  is usually quicker than to another section, and a tab that is slow to
 *  answer shouldn't keep the page still for long. */
const TAB_WAIT_LIMIT_MS = 800;

/**
 * Goes to `href` with the page crossfading into the new one, for tabs that
 * change what a page shows (the library's status tabs and shelves, the
 * Stats periods): returns true, or false when nothing should move ("Switching
 * tabs" set to straight away, animations off, no view transitions, or the
 * address already open), for the caller to navigate as usual.
 */
export function crossfadeTo(href: string, navigate: () => void): boolean {
  if (!canMove() || document.documentElement.dataset.tabChange === "off") return false;
  const target = new URL(href, window.location.href);
  if (target.pathname + target.search === window.location.pathname + window.location.search) return false;
  hold(href, navigate, ["tab-fade"], { skeletonAfter: TAB_WAIT_LIMIT_MS, limit: TAB_WAIT_LIMIT_MS, exact: true });
  return true;
}

function canMove(): boolean {
  return !(turning || typeof document === "undefined" || !document.startViewTransition || !motionAllowed());
}

/** Holds a picture of the page while `navigate` brings `href`, then lets
 *  the CSS under `classes` (globals.css, "Page turns") carry it away. The
 *  new page is in once the address has its path, or with `exact` (a tab on
 *  the same page) its query too. */
function hold(
  href: string,
  navigate: () => void,
  classes: string[],
  { skeletonAfter, limit, exact }: { skeletonAfter: number; limit: number; exact: boolean },
) {
  const html = document.documentElement;
  const target = new URL(href, window.location.href);
  const arrived = () =>
    window.location.pathname === target.pathname &&
    (!exact || window.location.search === target.search);
  html.classList.add(...classes);
  turning = true;

  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        navigate();
        const started = performance.now();
        const ready = () =>
          arrived() &&
          (!document.querySelector(".loading-sweep") || performance.now() - started > skeletonAfter);
        const land = () => {
          observer.disconnect();
          clearTimeout(look);
          clearTimeout(timer);
          // A new section's page fades up as it mounts ((app)/template.tsx);
          // here it's simply there under the turning page.
          document
            .querySelector(".page-in")
            ?.getAnimations()
            .forEach((a) => a.finish());
          resolve();
        };
        const observer = new MutationObserver(() => {
          if (ready()) land();
        });
        // Nothing may change once the skeleton is up: look again then.
        const look = setTimeout(() => ready() && land(), skeletonAfter + 10);
        const timer = setTimeout(land, limit);
        observer.observe(document.body, { childList: true, subtree: true });
        if (ready()) land();
      }),
  );
  transition.ready.catch(() => {});
  transition.finished
    .finally(() => {
      html.classList.remove(...classes);
      turning = false;
    })
    .catch(() => {});
}
