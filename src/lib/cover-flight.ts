import type { LibraryReturn } from "@/lib/library-return";
import { motionAllowed } from "@/lib/motion";

/** The view-transition name the travelling cover carries. Only ever on one
 *  element at a time: two elements with the same name abort a transition. */
const NAME = "book-cover";

/** How long to hold the old page while the book page (or, closing it, the
 *  library) loads. Past this the page swaps without the flight rather than
 *  look frozen. */
const WAIT_LIMIT_MS = 1500;

/** True when a cover can fly: the browser has view transitions and the
 *  reader hasn't turned animations off. */
export function canFlyCover(): boolean {
  return typeof document !== "undefined" && !!document.startViewTransition && motionAllowed();
}

/**
 * Opens a book's page with its cover flying from where it was clicked
 * (`cover`, in the library or a series strip) to its place on the book
 * page, while the rest of the page cross-fades.
 *
 * The browser snapshots the page with the clicked cover named, then holds
 * that picture while `navigate` runs. Once the book page's cover — the
 * BookCover marked `data-cover-for` with this book's id — is in the
 * document, it takes the name and the browser animates one into the other.
 */
export function flyCover(cover: HTMLElement, bookId: string, navigate: () => void): void {
  const selector = `[data-cover-for="${CSS.escape(bookId)}"]`;
  cover.style.viewTransitionName = NAME;

  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        // The old picture is taken; the name moves to the new cover.
        cover.style.viewTransitionName = "";
        navigate();

        const land = (target: HTMLElement | null) => {
          observer.disconnect();
          clearTimeout(timer);
          if (target) target.style.viewTransitionName = NAME;
          resolve();
        };
        const observer = new MutationObserver(() => {
          const target = document.querySelector<HTMLElement>(selector);
          if (target) land(target);
        });
        const timer = setTimeout(() => land(null), WAIT_LIMIT_MS);
        observer.observe(document.body, { childList: true, subtree: true });
      }),
  );

  transition.finished
    .finally(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (target) target.style.viewTransitionName = "";
    })
    .catch(() => {});
}

/** The library's card for a book: the cover inside its BookLink, or the
 *  link itself for a spine in the reading room. A grouped library can show a
 *  book in more than one group. */
function libraryCovers(bookId: string): HTMLElement[] {
  const link = `[data-book-link="${CSS.escape(bookId)}"]`;
  return [
    ...document.querySelectorAll<HTMLElement>(`${link} .book-cover, ${link}[data-flight-cover]`),
  ];
}

/** True while a book page closes, until the library is back. The library
 *  reads it as it mounts and leaves out its cards' rise-in, so it comes back
 *  the way it was left (components/library-view.tsx). */
let closing = false;
export function isClosingBook(): boolean {
  return closing;
}

/** How long a closed book page keeps watching for the library to put its
 *  scroll position back, after the flight itself has given up. */
const LIBRARY_WAIT_MS = 10_000;

/**
 * Waits for the library to render after a book page closes, then puts it
 * back where it was scrolled to and finds the card the book was opened from
 * (the one nearest where the clicked cover sat; a grouped library can show
 * a book twice). Resolves with that card's cover, or null when the book
 * isn't in the library any more (its status moved it off this tab, say) or
 * the library never came.
 */
function whenLibraryShows(back: LibraryReturn): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const finish = (target: HTMLElement | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(target);
    };
    const observer = new MutationObserver(() => {
      // [data-library-view] marks the library proper (or its "no books"
      // box, or the reading room's house), not its loading skeleton.
      const view = document.querySelector("[data-library-view]");
      if (!view?.getClientRects().length) return;

      window.scrollTo({ top: back.scrollY, behavior: "instant" });
      const distance = (el: HTMLElement) =>
        Math.abs(el.getBoundingClientRect().top + window.scrollY - back.coverY);
      const target = libraryCovers(back.bookId).sort((a, b) => distance(a) - distance(b))[0];
      if (!target) return finish(null);

      // A window resized since, say: bring the card into view so the cover
      // has somewhere to land.
      const rect = target.getBoundingClientRect();
      const barBottom = document.querySelector(".top-bar")?.getBoundingClientRect().bottom ?? 0;
      if (rect.top < barBottom || rect.bottom > window.innerHeight) {
        target.scrollIntoView({ block: "center", behavior: "instant" });
      }
      finish(target);
    });
    const timer = setTimeout(() => finish(null), LIBRARY_WAIT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Closes a book's page back to the library it was opened from (the X,
 * components/close-book-button.tsx; lib/library-return.ts). `navigate` goes
 * back to the library; this puts it back at the scroll position it had and
 * flies the book page's cover back into its card, the opening flight in
 * reverse. Without view transitions or with animations off the library just
 * comes back where it was.
 */
export function flyCoverHome(back: LibraryReturn, navigate: () => void): void {
  const hero = document.querySelector<HTMLElement>(
    `[data-cover-for="${CSS.escape(back.bookId)}"]`,
  );
  closing = true;
  const fly = hero && canFlyCover();
  if (!fly) navigate();
  const landing = whenLibraryShows(back);
  void landing.then(() => {
    closing = false;
  });
  if (!fly) return;

  hero.style.viewTransitionName = NAME;
  let target = null as HTMLElement | null;
  const transition = document.startViewTransition(async () => {
    hero.style.viewTransitionName = "";
    navigate();
    // A slow library swaps in without the flight, as opening does; the
    // scroll position still comes back once it arrives.
    target = await Promise.race([
      landing,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_LIMIT_MS)),
    ]);
    if (target) target.style.viewTransitionName = NAME;
  });

  transition.finished
    .finally(() => {
      if (target) target.style.viewTransitionName = "";
    })
    .catch(() => {});
}
