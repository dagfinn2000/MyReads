/**
 * The faces a reader can pick in Preferences › Text: one for everything
 * (the app's text), one for headings and one for long text (descriptions,
 * reviews, quotes and notes). Each slot also has "theme", which keeps
 * whatever the theme has there.
 *
 * Every face comes with the app (next/font in app/layout.tsx and
 * app/fonts.ts, each exposing its CSS variable), so a pick looks the same on
 * every device, and none is preloaded: the browser only fetches a face once
 * something on the page uses it. The one exception is the device's own
 * book serif, which downloads nothing.
 *
 * The root layout puts the picks on <html> as data-body-font,
 * data-heading-font and data-long-font, with the face itself in
 * --body-face, --heading-face and --long-face (fontStyle below), which
 * globals.css ("Reading preferences") hands to the page.
 */

export const FONT_SLOTS = ["body", "heading", "long"] as const;
export type FontSlot = (typeof FONT_SLOTS)[number];

export const FONT_KINDS = ["sans", "serif", "slab", "mono", "hand", "display"] as const;
export type FontKind = (typeof FONT_KINDS)[number];

export const FONT_KIND_LABELS: Record<FontKind, string> = {
  sans: "Sans serif",
  serif: "Serif",
  slab: "Slab serif",
  mono: "Typewriter and code",
  hand: "Handwriting",
  display: "Display, for headings",
};

export interface FontFace {
  id: string;
  /** As the picker lists it. */
  name: string;
  kind: FontKind;
  /** The face's CSS variable (app/layout.tsx, app/fonts.ts), or a stack of
   *  faces the device has. */
  face: string;
  /** A few words on what it is, after the name in the picker. */
  note?: string;
  /** The slots it's offered in, when not all three: display faces are for
   *  headings only, and faces too fine or too small for the app's own
   *  little words stay out of "everything". */
  slots?: readonly FontSlot[];
}

/** After a face, for the moment before it has loaded and for any letter it
 *  hasn't got. */
const FALLBACKS: Record<FontKind, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  slab: "Rockwell, ui-serif, Georgia, serif",
  mono: "ui-monospace, monospace",
  hand: "ui-rounded, ui-sans-serif, system-ui, sans-serif",
  display: "ui-serif, Georgia, serif",
};

const LONG_AND_HEADINGS: readonly FontSlot[] = ["heading", "long"];
const HEADINGS: readonly FontSlot[] = ["heading"];

export const FONTS: readonly FontFace[] = [
  // Sans serif
  { id: "geist", name: "Geist", kind: "sans", face: "var(--font-geist)", note: "the app’s own" },
  { id: "inter", name: "Inter", kind: "sans", face: "var(--font-inter)" },
  { id: "lexend", name: "Lexend", kind: "sans", face: "var(--font-lexend)", note: "made for easy reading" },
  {
    id: "hyperlegible",
    name: "Atkinson Hyperlegible",
    kind: "sans",
    face: "var(--font-hyperlegible)",
    note: "for low vision",
  },
  { id: "source-sans", name: "Source Sans", kind: "sans", face: "var(--font-source-sans)" },
  { id: "open-sans", name: "Open Sans", kind: "sans", face: "var(--font-open-sans)" },
  { id: "roboto", name: "Roboto", kind: "sans", face: "var(--font-roboto)" },
  { id: "noto-sans", name: "Noto Sans", kind: "sans", face: "var(--font-noto-sans)" },
  { id: "ubuntu", name: "Ubuntu Sans", kind: "sans", face: "var(--font-ubuntu)" },
  { id: "work-sans", name: "Work Sans", kind: "sans", face: "var(--font-work-sans)" },
  { id: "dm-sans", name: "DM Sans", kind: "sans", face: "var(--font-dm-sans)" },
  { id: "figtree", name: "Figtree", kind: "sans", face: "var(--font-figtree)" },
  { id: "manrope", name: "Manrope", kind: "sans", face: "var(--font-manrope)" },
  { id: "karla", name: "Karla", kind: "sans", face: "var(--font-karla)" },
  { id: "cabin", name: "Cabin", kind: "sans", face: "var(--font-cabin)", note: "after Johnston’s lettering" },
  { id: "outfit", name: "Outfit", kind: "sans", face: "var(--font-outfit)", note: "geometric" },
  { id: "raleway", name: "Raleway", kind: "sans", face: "var(--font-raleway)", note: "elegant" },
  { id: "josefin", name: "Josefin Sans", kind: "sans", face: "var(--font-josefin)", note: "1920s geometric" },
  { id: "nunito", name: "Nunito", kind: "sans", face: "var(--font-nunito)", note: "rounded" },
  { id: "quicksand", name: "Quicksand", kind: "sans", face: "var(--font-quicksand)", note: "rounded" },

  // Serif
  { id: "literata", name: "Literata", kind: "serif", face: "var(--font-literata)", note: "made for ebooks" },
  {
    id: "device-serif",
    name: "Your device’s book serif",
    kind: "serif",
    face: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, "Times New Roman"',
    note: "nothing to download",
  },
  { id: "lora", name: "Lora", kind: "serif", face: "var(--font-lora)" },
  { id: "merriweather", name: "Merriweather", kind: "serif", face: "var(--font-merriweather)", note: "sturdy, for screens" },
  { id: "source-serif", name: "Source Serif", kind: "serif", face: "var(--font-source-serif)" },
  { id: "eb-garamond", name: "EB Garamond", kind: "serif", face: "var(--font-eb-garamond)", note: "Renaissance" },
  { id: "baskerville", name: "Libre Baskerville", kind: "serif", face: "var(--font-baskerville)", note: "18th century" },
  { id: "crimson", name: "Crimson Pro", kind: "serif", face: "var(--font-crimson)" },
  { id: "newsreader", name: "Newsreader", kind: "serif", face: "var(--font-newsreader)" },
  { id: "alegreya", name: "Alegreya", kind: "serif", face: "var(--font-alegreya)", note: "calligraphic" },
  { id: "vollkorn", name: "Vollkorn", kind: "serif", face: "var(--font-vollkorn)" },
  { id: "gelasio", name: "Gelasio", kind: "serif", face: "var(--font-gelasio)", note: "like Georgia" },
  { id: "fraunces", name: "Fraunces", kind: "serif", face: "var(--font-fraunces)", note: "soft and a little wonky" },
  {
    id: "cormorant",
    name: "Cormorant Garamond",
    kind: "serif",
    face: "var(--font-cormorant)",
    note: "fine, best large",
    slots: LONG_AND_HEADINGS,
  },

  // Slab serif
  { id: "bitter", name: "Bitter", kind: "slab", face: "var(--font-bitter)" },
  { id: "roboto-slab", name: "Roboto Slab", kind: "slab", face: "var(--font-roboto-slab)" },

  // Typewriter and code
  { id: "typewriter", name: "Courier Prime", kind: "mono", face: "var(--font-typewriter)", note: "typewriter" },
  { id: "space-mono", name: "Space Mono", kind: "mono", face: "var(--font-space-mono)" },
  { id: "jetbrains", name: "JetBrains Mono", kind: "mono", face: "var(--font-jetbrains)" },

  // Handwriting
  { id: "patrick-hand", name: "Patrick Hand", kind: "hand", face: "var(--font-hand)" },
  { id: "architect", name: "Architects Daughter", kind: "hand", face: "var(--font-architect)" },
  { id: "caveat", name: "Caveat", kind: "hand", face: "var(--font-caveat)", note: "quick pen", slots: LONG_AND_HEADINGS },

  // Display, for headings
  { id: "playfair", name: "Playfair Display", kind: "display", face: "var(--font-playfair)", slots: HEADINGS },
  { id: "dm-serif", name: "DM Serif Display", kind: "display", face: "var(--font-dm-serif)", slots: HEADINGS },
  { id: "bodoni", name: "Bodoni Moda", kind: "display", face: "var(--font-bodoni)", note: "high fashion", slots: HEADINGS },
  { id: "young-serif", name: "Young Serif", kind: "display", face: "var(--font-young-serif)", slots: HEADINGS },
  { id: "cinzel", name: "Cinzel", kind: "display", face: "var(--font-cinzel)", note: "Roman capitals", slots: HEADINGS },
  {
    id: "blackletter",
    name: "UnifrakturMaguntia",
    kind: "display",
    face: "var(--font-fraktur)",
    note: "blackletter",
    slots: HEADINGS,
  },
  { id: "comic", name: "Bangers", kind: "display", face: "var(--font-bangers)", note: "comic lettering", slots: HEADINGS },
  { id: "vt323", name: "VT323", kind: "display", face: "var(--font-vt323)", note: "old terminal", slots: HEADINGS },
  { id: "pixel", name: "DotGothic16", kind: "display", face: "var(--font-pixel)", note: "pixels", slots: HEADINGS },
];

const BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export function fontById(id: string): FontFace | undefined {
  return BY_ID.get(id);
}

/** The faces offered in a slot, in the picker's order. */
export function fontsFor(slot: FontSlot): FontFace[] {
  return FONTS.filter((f) => !f.slots || f.slots.includes(slot));
}

/** A face with its fallbacks, as CSS font-family. */
export function fontFamily(font: FontFace): string {
  return `${font.face}, ${FALLBACKS[font.kind]}`;
}

/** What the slots held before there were more than three faces: headings
 *  were "sans" (the theme's), "serif" (Literata) or "rounded" (Nunito); long
 *  text "sans" (as everything else) or "serif" (the device's). */
const OLD_CHOICES: Record<FontSlot, Record<string, string>> = {
  body: {},
  heading: { sans: "theme", serif: "literata", rounded: "nunito" },
  long: { sans: "theme", serif: "device-serif" },
};

/** A stored choice for a slot, or "theme" when it isn't one it offers. */
export function pickFont(slot: FontSlot, value: unknown): string {
  if (typeof value !== "string") return "theme";
  const id = OLD_CHOICES[slot][value] ?? value;
  const font = BY_ID.get(id);
  return font && (!font.slots || font.slots.includes(slot)) ? id : "theme";
}

export interface FontPicks {
  bodyFont: string;
  headingFont: string;
  longTextFont: string;
}

const SLOT_PREFS: Record<FontSlot, keyof FontPicks> = {
  body: "bodyFont",
  heading: "headingFont",
  long: "longTextFont",
};

/** The <html> attribute and custom property that carry a slot's face. */
export const FONT_ATTRIBUTES: Record<FontSlot, { attribute: string; property: string }> = {
  body: { attribute: "data-body-font", property: "--body-face" },
  heading: { attribute: "data-heading-font", property: "--heading-face" },
  long: { attribute: "data-long-font", property: "--long-face" },
};

/** The custom properties for the faces picked, for <html>'s style: none
 *  for a slot left to the theme. */
export function fontStyle(picks: FontPicks): Record<string, string> {
  const style: Record<string, string> = {};
  for (const slot of FONT_SLOTS) {
    const font = BY_ID.get(picks[SLOT_PREFS[slot]]);
    if (font) style[FONT_ATTRIBUTES[slot].property] = fontFamily(font);
  }
  return style;
}

/** Whether the long text's face is a serif, which sets numbers as
 *  old-style figures (globals.css). */
export function longTextIsSerif(picks: Pick<FontPicks, "bodyFont" | "longTextFont">): boolean {
  const font = BY_ID.get(picks.longTextFont === "theme" ? picks.bodyFont : picks.longTextFont);
  return font?.kind === "serif" || font?.kind === "slab";
}

/**
 * Puts a slot's pick on <html> straight away, as the root layout will once
 * the change is saved: the attribute (left off for "theme") and the face.
 */
export function applyFont(html: HTMLElement, slot: FontSlot, id: string, picks: FontPicks) {
  const { attribute, property } = FONT_ATTRIBUTES[slot];
  const font = BY_ID.get(id);
  if (font) {
    html.setAttribute(attribute, id);
    html.style.setProperty(property, fontFamily(font));
  } else {
    html.removeAttribute(attribute);
    html.style.removeProperty(property);
  }
  const next = { ...picks, [SLOT_PREFS[slot]]: id };
  html.toggleAttribute("data-long-serif", longTextIsSerif(next));
}
