/**
 * The reader's avatar in the reading room (Decorate › You on the Room page):
 * how they look. Kept free of React so Preferences can validate the
 * choices. components/avatar-art.ts draws them, and reading-room.tsx has
 * them walk about the house, or sit in the armchair with the book they're
 * reading.
 */

export const AVATAR_SKINS = ["porcelain", "fair", "light", "olive", "tan", "brown", "deep"] as const;
export type AvatarSkin = (typeof AVATAR_SKINS)[number];

export const AVATAR_HAIRS = ["short", "long", "bob", "bun", "curly", "ponytail", "spiky", "bald"] as const;
export type AvatarHair = (typeof AVATAR_HAIRS)[number];

export const AVATAR_HAIR_COLOURS = [
  "black",
  "brown",
  "chestnut",
  "auburn",
  "ginger",
  "blonde",
  "grey",
  "white",
  "blue",
  "pink",
] as const;
export type AvatarHairColour = (typeof AVATAR_HAIR_COLOURS)[number];

export const AVATAR_TOPS = ["crimson", "forest", "navy", "mustard", "plum", "teal", "rose", "grey", "cream"] as const;
export type AvatarTop = (typeof AVATAR_TOPS)[number];

export const AVATAR_BOTTOMS = ["trousers", "skirt"] as const;
export type AvatarBottom = (typeof AVATAR_BOTTOMS)[number];

export const AVATAR_LEGS = ["denim", "black", "brown", "grey", "olive", "cream", "plum"] as const;
export type AvatarLegs = (typeof AVATAR_LEGS)[number];

export const AVATAR_HATS = ["none", "beanie", "wizard", "crown", "flower", "cap"] as const;
export type AvatarHat = (typeof AVATAR_HATS)[number];

export const AVATAR_EXTRAS = ["glasses", "beard", "freckles"] as const;
export type AvatarExtra = (typeof AVATAR_EXTRAS)[number];

export interface AvatarLook {
  skin: AvatarSkin;
  hair: AvatarHair;
  hairColour: AvatarHairColour;
  top: AvatarTop;
  bottom: AvatarBottom;
  legs: AvatarLegs;
  hat: AvatarHat;
  extras: AvatarExtra[];
}

export const DEFAULT_AVATAR: AvatarLook = {
  skin: "light",
  hair: "short",
  hairColour: "brown",
  top: "teal",
  bottom: "trousers",
  legs: "denim",
  hat: "none",
  extras: [],
};

export const SKIN_SWATCHES: Record<AvatarSkin, string> = {
  porcelain: "#f6dccb",
  fair: "#efc9a8",
  light: "#e2ad85",
  olive: "#c79a6b",
  tan: "#b47c52",
  brown: "#8b5a3a",
  deep: "#5e3b28",
};

export const HAIR_SWATCHES: Record<AvatarHairColour, string> = {
  black: "#2a2324",
  brown: "#5a3a26",
  chestnut: "#7a4426",
  auburn: "#8f3a2a",
  ginger: "#c66a2c",
  blonde: "#dcb764",
  grey: "#9a9894",
  white: "#e7e3da",
  blue: "#4a78c0",
  pink: "#d77aa6",
};

export const TOP_SWATCHES: Record<AvatarTop, string> = {
  crimson: "#9b3a43",
  forest: "#3f6e45",
  navy: "#34507e",
  mustard: "#c08f2c",
  plum: "#6d3b6e",
  teal: "#2f7a78",
  rose: "#c06a7c",
  grey: "#6b6f78",
  cream: "#e8dcc2",
};

export const LEGS_SWATCHES: Record<AvatarLegs, string> = {
  denim: "#3e5a85",
  black: "#2e2c31",
  brown: "#6a4a33",
  grey: "#77787d",
  olive: "#5f6a3a",
  cream: "#d9ccb1",
  plum: "#5a3150",
};

export const AVATAR_LABELS: Record<string, string> = {
  porcelain: "Porcelain",
  fair: "Fair",
  light: "Light",
  olive: "Olive",
  tan: "Tan",
  brown: "Brown",
  deep: "Deep brown",
  short: "Short",
  long: "Long",
  bob: "Bob",
  bun: "Bun",
  curly: "Curly",
  ponytail: "Ponytail",
  spiky: "Spiky",
  bald: "Bald",
  black: "Black",
  chestnut: "Chestnut",
  auburn: "Auburn",
  ginger: "Ginger",
  blonde: "Blonde",
  grey: "Grey",
  white: "White",
  blue: "Blue",
  pink: "Pink",
  crimson: "Crimson",
  forest: "Forest green",
  navy: "Navy",
  mustard: "Mustard",
  plum: "Plum",
  teal: "Teal",
  rose: "Rose",
  cream: "Cream",
  trousers: "Trousers",
  skirt: "Skirt",
  denim: "Denim",
  none: "No hat",
  beanie: "Beanie",
  wizard: "Wizard's hat",
  crown: "Crown",
  flower: "Flower",
  cap: "Flat cap",
  glasses: "Glasses",
  beard: "Beard",
  freckles: "Freckles",
};
