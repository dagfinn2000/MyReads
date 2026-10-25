import { NAV_ITEM_LABELS, type NavItem } from "@/lib/preferences";

/**
 * Keyboard shortcuts (components/keyboard-shortcuts.tsx): which key, or g
 * and then a key, does what. The rules live here, away from the page, so
 * they can be tested: the component reports each key and where it landed,
 * and carries out whatever action comes back.
 */

/** How long g waits for its second key, in milliseconds. */
export const PREFIX_MS = 1500;

/** g and then this key goes to that top-bar link, when the reader has it in
 *  their bar. Add book has n of its own. */
export const GO_KEYS: Record<Exclude<NavItem, "add">, string> = {
  library: "l",
  reading: "r",
  check: "c",
  quotes: "q",
  stats: "s",
  room: "m",
  series: "e",
};

export type ShortcutAction =
  | { type: "help" }
  | { type: "search" }
  | { type: "go"; to: NavItem }
  | { type: "edit"; href: string };

/** A key press, as the page saw it. */
export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Held down and repeating. */
  repeat: boolean;
  /** Part of a word being composed (Japanese input, say). */
  isComposing: boolean;
  /** Already handled by whatever had the focus. */
  defaultPrevented: boolean;
  /** It went to a text field, a menu of options or anything editable. */
  typing: boolean;
  /** A dialog, menu or list is open over the page. */
  overlay: boolean;
};

export type ShortcutContext = {
  /** The reader's top-bar links, in order (lib/nav.ts topBarLinks). */
  links: readonly NavItem[];
  pathname: string;
};

/** When g was pressed while it waits for a second key, or null. */
export type Pending = number | null;

/** Keys that only ever ride along with another: Shift on its way to ? keeps
 *  g waiting, rather than ending the wait. */
const HELD_KEYS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "Fn", "OS"]);

const GO_BY_KEY = new Map(
  Object.entries(GO_KEYS).map(([item, key]) => [key, item as Exclude<NavItem, "add">]),
);

/** The book whose page this path is (/books/<id>), or null: its edit page,
 *  Add book and Check aren't book pages. */
export function bookIdFromPath(pathname: string): string | null {
  const id = /^\/books\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!id || id === "new" || id === "check" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

/**
 * What a key press does, and whether g is still waiting afterwards. Keys
 * are left alone, for the page and the browser, while someone types, while
 * a dialog or menu is open, with Ctrl, Cmd or Alt held, or as a held key
 * repeats. A g sequence that doesn't name one of the reader's links does
 * nothing; any other key after g counts on its own.
 */
export function readShortcut(
  press: KeyPress,
  pending: Pending,
  now: number,
  ctx: ShortcutContext,
): { action: ShortcutAction | null; pending: Pending } {
  if (HELD_KEYS.has(press.key)) return { action: null, pending };
  const none = { action: null, pending: null };
  if (
    press.ctrlKey ||
    press.metaKey ||
    press.altKey ||
    press.repeat ||
    press.isComposing ||
    press.defaultPrevented ||
    press.typing ||
    press.overlay
  ) {
    return none;
  }

  if (pending !== null && now - pending <= PREFIX_MS) {
    const to = GO_BY_KEY.get(press.key);
    if (to) return ctx.links.includes(to) ? { action: { type: "go", to }, pending: null } : none;
  }

  switch (press.key) {
    case "?":
      return { action: { type: "help" }, pending: null };
    case "/":
      return { action: { type: "search" }, pending: null };
    case "n":
      return { action: { type: "go", to: "add" }, pending: null };
    case "g":
      return { action: null, pending: now };
    case "e": {
      const id = bookIdFromPath(ctx.pathname);
      return id ? { action: { type: "edit", href: `/books/${id}/edit` }, pending: null } : none;
    }
    default:
      return none;
  }
}

export type ShortcutGroup = {
  title: string;
  /** Keys pressed one after the other, and what they do. */
  items: { keys: string[]; label: string }[];
};

/** The shortcuts dialog's list: the g keys only for the links this reader
 *  has, in the order their top bar shows them. */
export function shortcutGroups(links: readonly NavItem[]): ShortcutGroup[] {
  return [
    {
      title: "Anywhere",
      items: [
        { keys: ["?"], label: "Show these shortcuts" },
        { keys: ["/"], label: "Search the library" },
        { keys: ["n"], label: "Add a book" },
      ],
    },
    {
      title: "Go to",
      items: links.flatMap((item) =>
        item === "add" ? [] : [{ keys: ["g", GO_KEYS[item]], label: NAV_ITEM_LABELS[item] }],
      ),
    },
    {
      title: "On a book's page",
      items: [{ keys: ["e"], label: "Edit the book" }],
    },
  ];
}
