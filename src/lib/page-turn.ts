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
 * are off, on a browser without view transitions, or with "Moving between
 * pages" set to a fade in Preferences, where pages fade up as before.
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
 * Goes to `href` (by calling `navigate`) with the page turning, and returns
 * true; or returns false without doing anything when the page shouldn't
 * turn, for the caller to navigate as usual.
 *
 * The browser snapshots the page as it is and holds that picture while
 * `navigate` runs. Once the new page is in, past its loading skeleton, the
 * old picture turns away to show it (or it turns in over the old).
 */
export function turnPage(href: string, navigate: () => void): boolean {
  if (turning || typeof document === "undefined" || !document.startViewTransition || !motionAllowed()) {
    return false;
  }
  const html = document.documentElement;
  if (html.dataset.pageChange === "fade") return false;

  const links = [...document.querySelectorAll<HTMLAnchorElement>(".top-bar a.nav-link")].map(
    (a) => a.getAttribute("href") ?? "",
  );
  const direction = pageTurnDirection(links, window.location.pathname, href);
  if (!direction) return false;

  const target = new URL(href, window.location.href).pathname;
  const classes = ["page-turn", `page-turn-${direction}`];
  html.classList.add(...classes);
  turning = true;

  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        navigate();
        const started = performance.now();
        const ready = () =>
          window.location.pathname === target &&
          (!document.querySelector(".loading-sweep") ||
            performance.now() - started > SKELETON_AFTER_MS);
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
        const look = setTimeout(() => ready() && land(), SKELETON_AFTER_MS + 10);
        const timer = setTimeout(land, WAIT_LIMIT_MS);
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
  return true;
}
