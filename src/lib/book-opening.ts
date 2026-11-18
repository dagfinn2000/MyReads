import { motionAllowed } from "@/lib/motion";
import { knownCoverColour } from "@/lib/cover-colours";
import { spineColour } from "@/lib/spine-colour";

/**
 * Opening a book the way you would a real one (Preferences > Motion >
 * Opening a book, `data-book-opening` on <html>; the other way is the cover
 * flying to its page, lib/cover-flight.ts).
 *
 * Tap a cover and it lifts out of its card into the middle of the window as
 * a closed book while the page behind it fades away. Then the front board
 * swings open on its hinge, turning to show the endpaper on its inside (in
 * the cover's own colour) and, on the right, the half-title: the book's
 * name alone on a cream page, as the first page of a book has it. The book
 * page loads all the while; once it is there and the book has opened, the
 * reader goes into the book (it draws a little closer and fades) and the
 * page is underneath.
 *
 * All of it lies between the top bar and the page (globals.css, "Book
 * opening"), so the top bar stays where it is. Built from the clicked cover
 * itself, so it looks like the book in the card: picture, ribbon, stickers
 * and all.
 */

/** How long the book takes to come to the middle, closed. */
const LIFT_MS = 420;
/** When the board starts to swing, and how long it takes to lie open. */
const SWING_AT_MS = 290;
const SWING_MS = 740;
/** Going into the book once the page is there. */
const ENTER_MS = 360;
/** When to go to the page: once the veil hides the page being left, so its
 *  loading placeholder never shows. */
const NAVIGATE_AT_MS = 220;
/** Past this the book goes in whether the page has come or not. */
const WAIT_LIMIT_MS = 4000;

/** True when tapping a cover opens it: the reader hasn't picked the flight
 *  instead, and animations may play. */
export function canOpenBook(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.bookOpening !== "fly" &&
    motionAllowed()
  );
}

/** Only one book opens at a time: a second tap while one is opening just
 *  goes where the first was going. */
let opening = false;

/**
 * Opens `cover` (a BookCover, `.book-cover`, in a card) as a book while
 * `navigate` goes to its page, the BookCover marked `data-cover-for` with
 * this book's id.
 */
export function openBook(cover: HTMLElement, bookId: string, navigate: () => void): void {
  const from = cover.getBoundingClientRect();
  if (opening || !from.width || !from.height) {
    navigate();
    return;
  }
  opening = true;

  // Where it opens: the middle of the window below the top bar (or above
  // it, on the themes that put it at the foot like a taskbar).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bar = document.querySelector(".top-bar")?.getBoundingClientRect();
  const atTop = bar && bar.height > 0 && bar.width > vw * 0.6 && bar.top < vh / 2;
  const atFoot = bar && bar.height > 0 && bar.width > vw * 0.6 && bar.top >= vh / 2;
  const areaTop = atTop ? Math.max(0, bar.bottom) : 0;
  const areaBottom = atFoot ? bar.top : vh;
  const area = areaBottom - areaTop;
  // The book's own shape, as big as fits with room for both pages side by
  // side once it lies open.
  const aspect = from.width / from.height;
  const h = Math.max(120, Math.min(area * 0.62, 460, (vw * 0.44) / aspect));
  const w = h * aspect;
  const top = areaTop + (area - h) / 2;
  const spine = vw / 2;

  const overlay = element("div", "book-opening");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--bo-top", `${areaTop}px`);
  overlay.style.setProperty("--bo-bottom", `${vh - areaBottom}px`);
  const veil = element("div", "bo-veil");
  const book = element("div", "bo-book");
  // The box is the right-hand page, the spine at the middle of the window:
  // where the book lies once it is open.
  Object.assign(book.style, { left: `${spine}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });

  const page = element("div", "bo-page");
  const title = titleOf(cover);
  const halfTitle = element("div", "bo-half-title");
  if (title) halfTitle.append(element("span", "bo-title", title));
  halfTitle.append(element("span", "bo-ornament"));
  const pageShade = element("div", "bo-page-shade");
  page.append(halfTitle, pageShade);

  const board = element("div", "bo-board");
  const front = element("div", "bo-front");
  front.append(copyCover(cover));
  const frontShade = element("div", "bo-shade");
  front.append(frontShade);
  const inside = element("div", "bo-inside");
  const colour = boardColour(cover);
  if (colour) inside.style.setProperty("--bo-board", colour);
  const insideShade = element("div", "bo-shade");
  inside.append(insideShade);
  board.append(front, inside);

  book.append(page, board);
  overlay.append(veil, book);
  document.body.append(overlay);
  // The card it came out of stands empty.
  cover.style.visibility = "hidden";

  // From the card to the middle, closed; then over to the right as the
  // board opens, so the open book sits on the middle. Scaled about the
  // spine, so the box's corner comes from the card's.
  const s = from.width / w;
  const dx = from.left - spine;
  const dy = from.top - top - (h - s * h) / 2;
  const total = SWING_AT_MS + SWING_MS;
  const fill = "both" as const;
  book.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)" },
      { transform: `translate(${-w / 2}px, 0) scale(1)`, offset: LIFT_MS / total, easing: "ease-in-out" },
      { transform: "translate(0, 0) scale(1)" },
    ],
    { duration: total, fill },
  );
  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LIFT_MS, easing: "ease-out", fill });
  // The board lifts slowly, swings over, drops flat and gives a small
  // bounce, the way a hardback's board falls open.
  const swing = { delay: SWING_AT_MS, duration: SWING_MS, fill };
  const swung = board.animate(
    [
      { transform: "rotateY(0deg)", easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
      { transform: "rotateY(-180deg)", offset: 0.78, easing: "ease-out" },
      { transform: "rotateY(-173deg)", offset: 0.89, easing: "ease-in" },
      { transform: "rotateY(-179deg)" },
    ],
    swing,
  );
  // Turning away from the light the cover darkens; the endpaper brightens
  // as it comes down; the board's shadow crosses the page.
  frontShade.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.4 }, { opacity: 0.6 }], swing);
  insideShade.animate([{ opacity: 0.55 }, { opacity: 0.55, offset: 0.4 }, { opacity: 0, offset: 0.78 }, { opacity: 0 }], swing);
  pageShade.animate([{ opacity: 0.5 }, { opacity: 0.35, offset: 0.35 }, { opacity: 0, offset: 0.75 }, { opacity: 0 }], swing);

  const selector = `[data-cover-for="${CSS.escape(bookId)}"]`;
  const arrived = new Promise<void>((resolve) => {
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) done();
    });
    const timer = setTimeout(done, WAIT_LIMIT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  });
  setTimeout(navigate, NAVIGATE_AT_MS);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    overlay.remove();
    cover.style.visibility = "";
    opening = false;
    window.removeEventListener("popstate", finish);
  };
  // Back (or forward) before the book is open: the opening is dropped.
  window.addEventListener("popstate", finish);
  void Promise.all([swung.finished, arrived])
    .then(() => {
      if (finished) return;
      const enter = { duration: ENTER_MS, easing: "ease-in", fill };
      book.animate([{ scale: "1" }, { scale: "1.08" }], enter);
      return overlay.animate([{ opacity: 1 }, { opacity: 0 }], enter).finished;
    })
    .catch(() => {})
    .finally(finish);
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** The book's title, from its cover: the picture's description ("Cover of
 *  …") or the title lettered on a drawn one. */
function titleOf(cover: HTMLElement): string {
  const drawn = cover.querySelector(".drawn-cover-title")?.textContent;
  if (drawn) return drawn.trim();
  const alt = cover.querySelector("img")?.alt ?? "";
  return alt.replace(/^Cover of /, "").trim();
}

/**
 * The cover as the book's front board: a copy of the card's cover, without
 * what makes it a card's (its tilt, its flight name, its lazy smaller
 * picture). The picture shows the copy the card already has at once, then
 * the full-size one once it has come (the one the book page shows too, so
 * it is on its way).
 */
function copyCover(cover: HTMLElement): HTMLElement {
  const copy = cover.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-cover-for");
  copy.removeAttribute("data-tilt");
  copy.removeAttribute("title");
  copy.removeAttribute("style");
  copy.classList.add("bo-cover");
  const original = cover.querySelector("img");
  const img = copy.querySelector("img");
  if (original && img) {
    const full = original.getAttribute("src") ?? "";
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.loading = "eager";
    img.src = original.currentSrc || full;
    if (full && img.src !== new URL(full, location.href).href) {
      const big = new Image();
      big.src = full;
      big
        .decode()
        .then(() => {
          img.src = full;
        })
        .catch(() => {});
    }
  }
  return copy;
}

/** The colour of the cover's board, for its endpaper: a drawn cover's own
 *  colour, or the main colour of its picture (known from the spines, or
 *  read now when the picture is the app's own). Null when there's no telling;
 *  the endpaper then takes the theme's. */
function boardColour(cover: HTMLElement): string | null {
  const drawn = cover.querySelector<HTMLElement>(".drawn-cover");
  if (drawn?.offsetParent) return getComputedStyle(drawn).backgroundColor;
  const img = cover.querySelector("img");
  const url = img?.getAttribute("src");
  if (!img || !url) return null;
  const known = knownCoverColour(url);
  if (known) return known;
  if (!img.complete || !img.naturalWidth) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 36;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 24, 36);
    return spineColour(ctx.getImageData(0, 0, 24, 36).data);
  } catch {
    // Another site's picture: it can't be read.
    return null;
  }
}
