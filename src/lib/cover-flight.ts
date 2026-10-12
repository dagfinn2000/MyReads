import { motionAllowed } from "@/lib/motion";

/** The view-transition name the travelling cover carries. Only ever on one
 *  element at a time: two elements with the same name abort a transition. */
const NAME = "book-cover";

/** How long to hold the old page while the book page loads. Past this the
 *  page swaps without the flight rather than look frozen. */
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
