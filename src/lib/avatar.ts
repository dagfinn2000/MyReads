/**
 * The reader's avatar in the reading room (Decorate › Avatar on the Room
 * page): how they look. Kept free of React so Preferences can check the
 * choices. components/avatar-art.ts draws them, and reading-room.tsx has
 * them walk about the house, or sit in the armchair with the book they're
 * reading.
 */

export const AVATAR_SKINS = [
  "porcelain",
  "fair",
  "light",
  "olive",
  "tan",
  "brown",
  "deep",
  // For elves, wizards and the space station.
  "mint",
  "sky",
  "lilac",
] as const;
export type AvatarSkin = (typeof AVATAR_SKINS)[number];

export const AVATAR_EYES = ["round", "happy", "sleepy", "sparkly", "lashes", "wink"] as const;
export type AvatarEyes = (typeof AVATAR_EYES)[number];

export const AVATAR_MOUTHS = ["smile", "grin", "small", "open", "tongue"] as const;
export type AvatarMouth = (typeof AVATAR_MOUTHS)[number];

export const AVATAR_CHEEKS = ["blush", "freckles", "spot"] as const;
export type AvatarCheek = (typeof AVATAR_CHEEKS)[number];

export const AVATAR_FACIAL_HAIR = ["none", "stubble", "moustache", "goatee", "beard", "longbeard"] as const;
export type AvatarFacialHair = (typeof AVATAR_FACIAL_HAIR)[number];

export const AVATAR_HAIRS = [
  "short",
  "swept",
  "buzz",
  "spiky",
  "mohawk",
  "curly",
  "afro",
  "bob",
  "long",
  "wavy",
  "ponytail",
  "pigtails",
  "braids",
  "bun",
  "spacebuns",
  "locs",
  "bald",
] as const;
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
  "red",
  "pink",
  "purple",
  "blue",
  "teal",
  "green",
] as const;
export type AvatarHairColour = (typeof AVATAR_HAIR_COLOURS)[number];

export const AVATAR_TOPS = [
  "jumper",
  "stripes",
  "tshirt",
  "hoodie",
  "cardigan",
  "shirt",
  "vest",
  "coat",
  "dress",
  "robe",
] as const;
export type AvatarTop = (typeof AVATAR_TOPS)[number];
/** Tops that reach the knees or the floor, so there's nothing below. */
export const LONG_TOPS: readonly AvatarTop[] = ["dress", "robe"];

export const AVATAR_BOTTOMS = ["trousers", "jeans", "shorts", "skirt", "longskirt", "dungarees"] as const;
export type AvatarBottom = (typeof AVATAR_BOTTOMS)[number];

export const AVATAR_SHOES = ["shoes", "boots", "trainers", "slippers", "wellies", "sandals"] as const;
export type AvatarShoes = (typeof AVATAR_SHOES)[number];

export const AVATAR_HATS = [
  "none",
  "beanie",
  "baseball",
  "cap",
  "beret",
  "tophat",
  "wizard",
  "witch",
  "crown",
  "tiara",
  "flower",
  "bow",
  "headband",
  "catears",
  "bunnyears",
  "horns",
  "halo",
] as const;
export type AvatarHat = (typeof AVATAR_HATS)[number];

export const AVATAR_ACCESSORIES = [
  "glasses",
  "sunglasses",
  "earrings",
  "necklace",
  "scarf",
  "bowtie",
  "headphones",
  "backpack",
  "cape",
] as const;
export type AvatarAccessory = (typeof AVATAR_ACCESSORIES)[number];

/** Clothes colours: tops, and what's worn below. */
export const AVATAR_CLOTH_COLOURS = [
  "crimson",
  "red",
  "orange",
  "mustard",
  "forest",
  "sage",
  "teal",
  "sky",
  "navy",
  "denim",
  "plum",
  "lilac",
  "rose",
  "brown",
  "khaki",
  "grey",
  "black",
  "cream",
  "white",
] as const;
export type AvatarClothColour = (typeof AVATAR_CLOTH_COLOURS)[number];

/** The colour of a scarf, a cape, a beanie, a bow and the like. */
export const AVATAR_ACCENTS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gold",
] as const;
export type AvatarAccent = (typeof AVATAR_ACCENTS)[number];

export interface AvatarLook {
  skin: AvatarSkin;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  cheeks: AvatarCheek[];
  facialHair: AvatarFacialHair;
  hair: AvatarHair;
  hairColour: AvatarHairColour;
  top: AvatarTop;
  topColour: AvatarClothColour;
  bottom: AvatarBottom;
  bottomColour: AvatarClothColour;
  shoes: AvatarShoes;
  hat: AvatarHat;
  accessories: AvatarAccessory[];
  accent: AvatarAccent;
}

export const DEFAULT_AVATAR: AvatarLook = {
  skin: "light",
  eyes: "round",
  mouth: "smile",
  cheeks: ["blush"],
  facialHair: "none",
  hair: "short",
  hairColour: "brown",
  top: "jumper",
  topColour: "teal",
  bottom: "trousers",
  bottomColour: "denim",
  shoes: "shoes",
  hat: "none",
  accessories: [],
  accent: "red",
};

const pick = <T extends readonly string[]>(allowed: T, value: unknown, fallback: T[number]): T[number] =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
const pickList = <T extends readonly string[]>(allowed: T, value: unknown): T[number][] =>
  Array.isArray(value) ? allowed.filter((a) => value.includes(a)) : [];

/** The first avatars, before there was a wardrobe, were saved a little
 *  differently: `top` was the jumper's colour, `legs` the trousers', and
 *  glasses, a beard and freckles were "extras". */
const OLD_LEGS: Record<string, AvatarClothColour> = { olive: "khaki" };

/** A saved look, with a default for anything missing or unknown. */
export function parseAvatar(value: unknown): AvatarLook {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR;
  const extras = Array.isArray(o.extras) ? o.extras : null;
  const oldTop = typeof o.top === "string" && !(AVATAR_TOPS as readonly string[]).includes(o.top);
  const oldLegs = typeof o.legs === "string" ? (OLD_LEGS[o.legs] ?? o.legs) : undefined;
  let cheeks: AvatarCheek[] = Array.isArray(o.cheeks) ? pickList(AVATAR_CHEEKS, o.cheeks) : d.cheeks;
  if (extras) cheeks = extras.includes("freckles") ? ["freckles"] : ["blush"];
  return {
    skin: pick(AVATAR_SKINS, o.skin, d.skin),
    eyes: pick(AVATAR_EYES, o.eyes, d.eyes),
    mouth: pick(AVATAR_MOUTHS, o.mouth, d.mouth),
    cheeks,
    facialHair: extras?.includes("beard") ? "beard" : pick(AVATAR_FACIAL_HAIR, o.facialHair, d.facialHair),
    hair: pick(AVATAR_HAIRS, o.hair, d.hair),
    hairColour: pick(AVATAR_HAIR_COLOURS, o.hairColour, d.hairColour),
    top: oldTop ? "jumper" : pick(AVATAR_TOPS, o.top, d.top),
    topColour: pick(AVATAR_CLOTH_COLOURS, oldTop ? o.top : o.topColour, d.topColour),
    bottom: pick(AVATAR_BOTTOMS, o.bottom, d.bottom),
    bottomColour: pick(AVATAR_CLOTH_COLOURS, oldLegs ?? o.bottomColour, d.bottomColour),
    shoes: pick(AVATAR_SHOES, o.shoes, d.shoes),
    hat: pick(AVATAR_HATS, o.hat, d.hat),
    accessories: extras ? (extras.includes("glasses") ? ["glasses"] : []) : pickList(AVATAR_ACCESSORIES, o.accessories),
    accent: pick(AVATAR_ACCENTS, o.accent, d.accent),
  };
}

/** A look picked at random, for "Surprise me". `random` returns [0, 1). */
export function randomLook(random: () => number = Math.random): AvatarLook {
  const any = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const some = <T>(list: readonly T[], chance: number, most: number): T[] =>
    list.filter(() => random() < chance).slice(0, most);
  return {
    // Mostly everyday skin tones; now and then an elf or a spaceman.
    skin: random() < 0.12 ? any(AVATAR_SKINS.slice(7)) : any(AVATAR_SKINS.slice(0, 7)),
    eyes: random() < 0.5 ? "round" : any(AVATAR_EYES),
    mouth: random() < 0.5 ? "smile" : any(AVATAR_MOUTHS),
    cheeks: some(AVATAR_CHEEKS, 0.35, 2),
    facialHair: random() < 0.75 ? "none" : any(AVATAR_FACIAL_HAIR),
    hair: any(AVATAR_HAIRS),
    hairColour: random() < 0.75 ? any(AVATAR_HAIR_COLOURS.slice(0, 8)) : any(AVATAR_HAIR_COLOURS),
    top: any(AVATAR_TOPS),
    topColour: any(AVATAR_CLOTH_COLOURS),
    bottom: any(AVATAR_BOTTOMS),
    bottomColour: any(AVATAR_CLOTH_COLOURS),
    shoes: any(AVATAR_SHOES),
    hat: random() < 0.55 ? "none" : any(AVATAR_HATS.slice(1)),
    accessories: some(AVATAR_ACCESSORIES, 0.18, 3),
    accent: any(AVATAR_ACCENTS),
  };
}

export const SKIN_SWATCHES: Record<AvatarSkin, string> = {
  porcelain: "#f6dccb",
  fair: "#efc9a8",
  light: "#e2ad85",
  olive: "#c79a6b",
  tan: "#b47c52",
  brown: "#8b5a3a",
  deep: "#5e3b28",
  mint: "#9fcfa8",
  sky: "#8fb4dd",
  lilac: "#bfa3d8",
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
  red: "#c2333c",
  pink: "#d77aa6",
  purple: "#7a4fb0",
  blue: "#4a78c0",
  teal: "#2f9a94",
  green: "#4f9a46",
};

export const CLOTH_SWATCHES: Record<AvatarClothColour, string> = {
  crimson: "#9b3a43",
  red: "#c8443c",
  orange: "#d77a36",
  mustard: "#c08f2c",
  forest: "#3f6e45",
  sage: "#8aa37f",
  teal: "#2f7a78",
  sky: "#6ea6d4",
  navy: "#34507e",
  denim: "#3e5a85",
  plum: "#6d3b6e",
  lilac: "#a98bc8",
  rose: "#c06a7c",
  brown: "#6a4a33",
  khaki: "#8f8456",
  grey: "#6b6f78",
  black: "#2e2c31",
  cream: "#e8dcc2",
  white: "#f2f0ea",
};

export const ACCENT_SWATCHES: Record<AvatarAccent, string> = {
  red: "#c8343f",
  orange: "#e0802e",
  yellow: "#e8c33a",
  green: "#4c9a4a",
  teal: "#2c9690",
  blue: "#3f6fc4",
  purple: "#7a4fb0",
  pink: "#e07aa8",
  brown: "#7a5236",
  black: "#2b282d",
  white: "#f1eee6",
  gold: "#c9a144",
};

export const AVATAR_LABELS: Record<string, string> = {
  // Skin
  porcelain: "Porcelain",
  fair: "Fair",
  light: "Light",
  olive: "Olive",
  tan: "Tan",
  deep: "Deep brown",
  mint: "Elf green",
  lilac: "Lilac",
  // Eyes, mouth, cheeks, facial hair
  round: "Round",
  happy: "Happy",
  sleepy: "Sleepy",
  sparkly: "Sparkly",
  lashes: "Lashes",
  wink: "Wink",
  smile: "Smile",
  grin: "Grin",
  small: "Small",
  open: "Open",
  tongue: "Tongue out",
  blush: "Blush",
  freckles: "Freckles",
  spot: "Beauty spot",
  stubble: "Stubble",
  moustache: "Moustache",
  goatee: "Goatee",
  beard: "Beard",
  longbeard: "Long beard",
  // Hair
  short: "Short",
  swept: "Swept",
  buzz: "Buzz cut",
  spiky: "Spiky",
  mohawk: "Mohawk",
  curly: "Curly",
  afro: "Afro",
  bob: "Bob",
  long: "Long",
  wavy: "Wavy",
  ponytail: "Ponytail",
  pigtails: "Pigtails",
  braids: "Braids",
  bun: "Bun",
  spacebuns: "Space buns",
  locs: "Locs",
  bald: "Bald",
  // Colours
  black: "Black",
  brown: "Brown",
  chestnut: "Chestnut",
  auburn: "Auburn",
  ginger: "Ginger",
  blonde: "Blonde",
  grey: "Grey",
  white: "White",
  red: "Red",
  pink: "Pink",
  purple: "Purple",
  blue: "Blue",
  teal: "Teal",
  green: "Green",
  crimson: "Crimson",
  orange: "Orange",
  mustard: "Mustard",
  forest: "Forest green",
  sage: "Sage",
  sky: "Sky blue",
  navy: "Navy",
  denim: "Denim",
  plum: "Plum",
  rose: "Rose",
  khaki: "Khaki",
  cream: "Cream",
  yellow: "Yellow",
  gold: "Gold",
  // Clothes
  jumper: "Jumper",
  stripes: "Stripy jumper",
  tshirt: "T-shirt",
  hoodie: "Hoodie",
  cardigan: "Cardigan",
  shirt: "Shirt",
  vest: "Waistcoat",
  coat: "Long coat",
  dress: "Dress",
  robe: "Robe",
  trousers: "Trousers",
  jeans: "Jeans",
  shorts: "Shorts",
  skirt: "Skirt",
  longskirt: "Long skirt",
  dungarees: "Dungarees",
  shoes: "Shoes",
  boots: "Boots",
  trainers: "Trainers",
  slippers: "Slippers",
  wellies: "Wellies",
  sandals: "Sandals",
  // Hats
  none: "None",
  beanie: "Beanie",
  baseball: "Baseball cap",
  cap: "Flat cap",
  beret: "Beret",
  tophat: "Top hat",
  wizard: "Wizard's hat",
  witch: "Witch's hat",
  crown: "Crown",
  tiara: "Tiara",
  flower: "Flower",
  bow: "Bow",
  headband: "Headband",
  catears: "Cat ears",
  bunnyears: "Bunny ears",
  horns: "Horns",
  halo: "Halo",
  // Accessories
  glasses: "Glasses",
  sunglasses: "Sunglasses",
  earrings: "Earrings",
  necklace: "Necklace",
  scarf: "Scarf",
  bowtie: "Bow tie",
  headphones: "Headphones",
  backpack: "Backpack",
  cape: "Cape",
};
