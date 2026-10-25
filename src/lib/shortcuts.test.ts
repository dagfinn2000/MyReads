import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, NAV_ITEMS, parsePreferences } from "@/lib/preferences";
import { topBarLinks } from "@/lib/nav";
import {
  GO_KEYS,
  PREFIX_MS,
  bookIdFromPath,
  readShortcut,
  shortcutGroups,
  type KeyPress,
  type Pending,
  type ShortcutContext,
} from "./shortcuts";

const everyLink: ShortcutContext = { links: NAV_ITEMS, pathname: "/books" };

function press(key: string, over: Partial<KeyPress> = {}): KeyPress {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    typing: false,
    overlay: false,
    ...over,
  };
}

/** Keys typed one after another, `gap` ms apart; the last one's result. */
function sequence(keys: string[], ctx = everyLink, gap = 100) {
  let pending: Pending = null;
  let result: ReturnType<typeof readShortcut> = { action: null, pending: null };
  keys.forEach((key, i) => {
    result = readShortcut(press(key), pending, 10_000 + i * gap, ctx);
    pending = result.pending;
  });
  return result;
}

describe("readShortcut", () => {
  it("opens the list, searches and adds a book with one key", () => {
    expect(sequence(["?"]).action).toEqual({ type: "help" });
    expect(sequence(["/"]).action).toEqual({ type: "search" });
    expect(sequence(["n"]).action).toEqual({ type: "go", to: "add" });
  });

  it("goes to a top-bar link with g and its letter", () => {
    expect(sequence(["g", "l"]).action).toEqual({ type: "go", to: "library" });
    expect(sequence(["g", "s"]).action).toEqual({ type: "go", to: "stats" });
    expect(sequence(["g", "r"]).action).toEqual({ type: "go", to: "reading" });
    expect(sequence(["g", "q"]).action).toEqual({ type: "go", to: "quotes" });
    expect(sequence(["g", "m"]).action).toEqual({ type: "go", to: "room" });
    expect(sequence(["g", "e"]).action).toEqual({ type: "go", to: "series" });
    expect(sequence(["g", "c"]).action).toEqual({ type: "go", to: "check" });
  });

  it("waits after g, and gives up after a second and a half", () => {
    expect(sequence(["g"])).toEqual({ action: null, pending: 10_000 });
    expect(sequence(["g", "l"], everyLink, PREFIX_MS).action).toEqual({ type: "go", to: "library" });
    expect(sequence(["g", "l"], everyLink, PREFIX_MS + 1)).toEqual({ action: null, pending: null });
  });

  it("skips links the reader doesn't have", () => {
    const prefs = parsePreferences({ hiddenNav: ["room", "quotes"] });
    const ctx = { links: topBarLinks(prefs), pathname: "/stats" };
    expect(sequence(["g", "m"], ctx)).toEqual({ action: null, pending: null });
    expect(sequence(["g", "q"], ctx)).toEqual({ action: null, pending: null });
    // Series is off until it's turned on.
    const plain = { links: topBarLinks(DEFAULT_PREFERENCES), pathname: "/stats" };
    expect(sequence(["g", "e"], plain).action).toBeNull();
    expect(sequence(["g", "s"], plain).action).toEqual({ type: "go", to: "stats" });
  });

  it("reads any other key after g on its own", () => {
    expect(sequence(["g", "?"]).action).toEqual({ type: "help" });
    expect(sequence(["g", "x"])).toEqual({ action: null, pending: null });
    // A second g starts the wait again.
    expect(sequence(["g", "g"]).pending).toBe(10_100);
    expect(sequence(["g", "x", "l"]).action).toBeNull();
  });

  it("keeps g waiting while Shift goes down for a capital or ?", () => {
    expect(sequence(["g", "Shift", "?"]).action).toEqual({ type: "help" });
    expect(sequence(["g", "Shift", "l"]).action).toEqual({ type: "go", to: "library" });
  });

  it("edits the book on a book's page, and nowhere else", () => {
    const on = (pathname: string) => sequence(["e"], { links: NAV_ITEMS, pathname }).action;
    expect(on("/books/cm9x2abc")).toEqual({ type: "edit", href: "/books/cm9x2abc/edit" });
    expect(on("/books/cm9x2abc/edit")).toBeNull();
    expect(on("/books")).toBeNull();
    expect(on("/books/new")).toBeNull();
    expect(on("/stats")).toBeNull();
  });

  it("never fires while typing, over a dialog or with Ctrl, Cmd or Alt", () => {
    const blocked: Partial<KeyPress>[] = [
      { typing: true },
      { overlay: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { repeat: true },
      { isComposing: true },
      { defaultPrevented: true },
    ];
    for (const over of blocked) {
      for (const key of ["?", "/", "n", "g", "e"]) {
        expect(readShortcut(press(key, over), null, 0, everyLink)).toEqual({
          action: null,
          pending: null,
        });
      }
      // And the wait after g ends with it, so Cmd+L isn't g then l.
      expect(readShortcut(press("l", over), 0, 100, everyLink)).toEqual({
        action: null,
        pending: null,
      });
    }
  });

  it("leaves capitals and other keys alone", () => {
    for (const key of ["N", "G", "E", "Escape", "Enter", " ", "ArrowDown", "k"]) {
      expect(sequence([key]).action).toBeNull();
    }
  });
});

describe("bookIdFromPath", () => {
  it("finds a book's id only on its own page", () => {
    expect(bookIdFromPath("/books/abc_123-x")).toBe("abc_123-x");
    expect(bookIdFromPath("/books/abc/")).toBe("abc");
    expect(bookIdFromPath("/books/check")).toBeNull();
    expect(bookIdFromPath("/books/a%2F..")).toBeNull();
    expect(bookIdFromPath("/series")).toBeNull();
  });
});

describe("shortcutGroups", () => {
  it("lists a g key for each of the reader's links, in their order", () => {
    const prefs = parsePreferences({
      navOrder: ["stats", "library"],
      hiddenNav: ["room"],
      shownNav: ["series"],
    });
    const goTo = shortcutGroups(topBarLinks(prefs)).find((g) => g.title === "Go to");
    expect(goTo?.items.map((i) => i.keys.join(" "))).toEqual([
      "g s",
      "g l",
      "g r",
      "g c",
      "g q",
      "g e",
    ]);
  });

  it("gives every link but Add book its own letter", () => {
    const letters = Object.values(GO_KEYS);
    expect(new Set(letters).size).toBe(letters.length);
    expect(letters).not.toContain("g");
    expect(letters).not.toContain("n");
  });
});
