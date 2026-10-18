/**
 * How the reading room can be decorated (the Decorate panel on the Room
 * page): the style of the house, the colours of its walls, wood and
 * fabrics, its wallpaper and floors, what hangs over the fireplace and
 * along the ceilings, and the walls and floor of each added room. Kept
 * free of React so Preferences can validate the choices.
 *
 * A style changes the shell of the house (its roof, outside walls, inside
 * walls, garden and lamps, drawn in components/room-shells.ts) and its
 * palette (components/reading-room.css). The colour choices then repaint
 * one part of whichever style is chosen; "style" keeps the style's own.
 */

export const ROOM_STYLES = [
  "cottage",
  "medieval",
  "fantasy",
  "elven",
  "cave",
  "scifi",
  "modern",
  "cabin",
  "japanese",
  "steampunk",
] as const;
export type RoomStyle = (typeof ROOM_STYLES)[number];

export const ROOM_STYLE_LABELS: Record<RoomStyle, { name: string; blurb: string }> = {
  cottage: { name: "Cottage", blurb: "Brick, a tiled roof and striped wallpaper." },
  medieval: { name: "Castle", blurb: "A stone keep with battlements and a banner." },
  fantasy: { name: "Wizard's house", blurb: "A crooked spire, starry walls and toadstools." },
  elven: { name: "Elven hall", blurb: "Pale wood under a roof of leaves, among birches." },
  cave: { name: "Cave", blurb: "Dug into a grassy hill, with rock walls and torches." },
  scifi: { name: "Space station", blurb: "Metal panels, glowing strips and a plasma fire." },
  modern: { name: "Modern", blurb: "White walls, a flat roof and light oak." },
  cabin: { name: "Log cabin", blurb: "Round logs, a turf roof and pine trees." },
  japanese: { name: "Tea house", blurb: "Paper screens, dark timber and a stone lantern." },
  steampunk: { name: "Workshop", blurb: "Copper, brass, pipes and turning gears." },
};

/** Wall colours: the style's own, or a paint of your choosing. */
export const ROOM_WALLS = [
  "style",
  "cream",
  "sage",
  "sky",
  "rose",
  "lavender",
  "ochre",
  "slate",
  "charcoal",
] as const;
export type RoomWalls = (typeof ROOM_WALLS)[number];

export const ROOM_WOODS = ["style", "birch", "oak", "walnut", "mahogany", "ebony", "grey"] as const;
export type RoomWood = (typeof ROOM_WOODS)[number];

/** The armchair, curtains, cushions and rug. */
export const ROOM_FABRICS = [
  "style",
  "crimson",
  "forest",
  "navy",
  "mustard",
  "plum",
  "teal",
  "rose",
  "grey",
] as const;
export type RoomFabric = (typeof ROOM_FABRICS)[number];

/** What hangs over the fireplace: a painting, a tapestry in one of five
 *  designs (woven in the fabric colours), or nothing. */
export const ROOM_HANGINGS = ["painting", "tree", "stag", "stars", "waves", "kilim", "none"] as const;
export type RoomHanging = (typeof ROOM_HANGINGS)[number];

export const ROOM_HANGING_LABELS: Record<RoomHanging, string> = {
  painting: "Painting",
  tree: "Tree of life",
  stag: "Stag",
  stars: "Sun and moon",
  waves: "Waves",
  kilim: "Kilim",
  none: "Nothing",
};

/** The fireside (Decorate › House › By the fire, components/room-
 *  fireside.ts): the fireplace, the armchair the reading happens in, the
 *  rug in front and the lamp by the side table. The first of each is the
 *  one the house has always had. */
export const ROOM_FIREPLACES = ["stone", "brick", "marble", "tiles", "modern"] as const;
export type RoomFireplace = (typeof ROOM_FIREPLACES)[number];

export const ROOM_FIREPLACE_LABELS: Record<RoomFireplace, string> = {
  stone: "Stone arch",
  brick: "Brick",
  marble: "Marble",
  tiles: "Blue tiles",
  modern: "Modern",
};

export const ROOM_CHAIRS = ["wingback", "club", "chesterfield", "lounge", "throne"] as const;
export type RoomChair = (typeof ROOM_CHAIRS)[number];

export const ROOM_CHAIR_LABELS: Record<RoomChair, string> = {
  wingback: "Wingback",
  club: "Club chair",
  chesterfield: "Chesterfield",
  lounge: "Lounge chair",
  throne: "Carved chair",
};

export const ROOM_RUGS = ["fringed", "persian", "braided", "kilim", "sheepskin", "none"] as const;
export type RoomRug = (typeof ROOM_RUGS)[number];

export const ROOM_RUG_LABELS: Record<RoomRug, string> = {
  fringed: "Fringed",
  persian: "Persian",
  braided: "Braided",
  kilim: "Kilim",
  sheepskin: "Sheepskin",
  none: "No rug",
};

export const ROOM_LAMPS = ["standard", "tiffany", "arc", "candles", "lantern"] as const;
export type RoomLamp = (typeof ROOM_LAMPS)[number];

export const ROOM_LAMP_LABELS: Record<RoomLamp, string> = {
  standard: "Standard lamp",
  tiffany: "Tiffany lamp",
  arc: "Arc lamp",
  candles: "Candle stand",
  lantern: "Paper lantern",
};

/** The bookcases (Decorate › House › Bookcases, components/room-
 *  bookcases.ts), in the wood colour, and what stands on their shelves
 *  beside the books. */
export const ROOM_BOOKCASES = ["classic", "open", "pediment", "gothic", "glazed"] as const;
export type RoomBookcase = (typeof ROOM_BOOKCASES)[number];

export const ROOM_BOOKCASE_LABELS: Record<RoomBookcase, string> = {
  classic: "Classic",
  open: "Open shelves",
  pediment: "Pediment",
  gothic: "Gothic",
  glazed: "Glass doors",
};

export const ROOM_ORNAMENTS = ["some", "plenty", "none"] as const;
export type RoomOrnaments = (typeof ROOM_ORNAMENTS)[number];

export const ROOM_ORNAMENT_LABELS: Record<RoomOrnaments, string> = {
  some: "A few",
  plenty: "Plenty",
  none: "Just books",
};

/** Wallpaper: the style's own, or any of the styles' patterns, or one of
 *  four more. Printed in the wall colour, a shade darker. */
export const ROOM_PAPERS = [
  "style",
  "stripes",
  "damask",
  "flowers",
  "trellis",
  "stars",
  "vines",
  "stones",
  "rock",
  "logs",
  "panels",
  "tiles",
  "shoji",
  "pipes",
  "plain",
] as const;
export type RoomPaper = (typeof ROOM_PAPERS)[number];

export const ROOM_PAPER_LABELS: Record<RoomPaper, string> = {
  style: "The style's own",
  stripes: "Stripes",
  damask: "Damask",
  flowers: "Flowers",
  trellis: "Trellis",
  stars: "Stars",
  vines: "Vines",
  stones: "Stone",
  rock: "Rock",
  logs: "Logs",
  panels: "Panels",
  tiles: "Tiles",
  shoji: "Paper screens",
  pipes: "Rivets",
  plain: "Plain",
};

/** Floors: the style's own, or boards of either width, parquet, flagstones,
 *  chequered tiles, carpet in the fabric colour, tatami or a metal grate. */
export const ROOM_FLOORS = ["style", "boards", "planks", "parquet", "flags", "tiles", "carpet", "tatami", "grate"] as const;
export type RoomFloor = (typeof ROOM_FLOORS)[number];

export const ROOM_FLOOR_LABELS: Record<RoomFloor, string> = {
  style: "The style's own",
  boards: "Boards",
  planks: "Wide planks",
  parquet: "Parquet",
  flags: "Flagstones",
  tiles: "Chequered tiles",
  carpet: "Carpet",
  tatami: "Tatami",
  grate: "Metal grate",
};

/** Strung along the top of every room's walls, over the furniture. */
export const ROOM_CEILINGS = ["none", "fairylights", "bunting", "lanterns", "ivy"] as const;
export type RoomCeiling = (typeof ROOM_CEILINGS)[number];

export const ROOM_CEILING_LABELS: Record<RoomCeiling, string> = {
  none: "Nothing",
  fairylights: "Fairy lights",
  bunting: "Bunting",
  lanterns: "Paper lanterns",
  ivy: "Ivy",
};

/** Windows in the back wall of every room, wherever the wall is clear of
 *  furniture: the sky outside by day, the moon and stars at night. */
export const ROOM_WINDOWS = ["none", "sash", "arched", "round", "shutters", "leaded"] as const;
export type RoomWindow = (typeof ROOM_WINDOWS)[number];

export const ROOM_WINDOW_LABELS: Record<RoomWindow, string> = {
  none: "No windows",
  sash: "Sash windows",
  arched: "Arched",
  round: "Round",
  shutters: "With shutters",
  leaded: "Leaded panes",
};

/** Pictures on the walls of every room, wherever furniture leaves space,
 *  in turn with the windows (components/room-pictures.ts); a mix takes
 *  each kind in turn. */
export const ROOM_PICTURES = ["none", "paintings", "portraits", "prints", "maps", "photos", "mixed"] as const;
export type RoomPictures = (typeof ROOM_PICTURES)[number];

export const ROOM_PICTURE_LABELS: Record<RoomPictures, string> = {
  none: "Bare walls",
  paintings: "Paintings",
  portraits: "Portraits",
  prints: "Botanical prints",
  maps: "Maps and charts",
  photos: "Photographs",
  mixed: "A bit of each",
};

/** What grows up the outside walls of the house. */
export const ROOM_CLIMBERS = ["none", "ivy", "roses", "wisteria"] as const;
export type RoomClimber = (typeof ROOM_CLIMBERS)[number];

export const ROOM_CLIMBER_LABELS: Record<RoomClimber, string> = {
  none: "Bare walls",
  ivy: "Ivy",
  roses: "Climbing roses",
  wisteria: "Wisteria",
};

/** What grows (or stands) in the garden round the house; any of them. */
export const ROOM_GARDEN = ["flowers", "bushes", "trees", "fence"] as const;
export type RoomGarden = (typeof ROOM_GARDEN)[number];

export const ROOM_GARDEN_LABELS: Record<RoomGarden, string> = {
  flowers: "Flower beds",
  bushes: "Bushes",
  trees: "Trees",
  fence: "Picket fence",
};

/** An added room's own walls and floor; "style" in each is the house's. */
export interface RoomOwn {
  walls: RoomWalls;
  paper: RoomPaper;
  floor: RoomFloor;
}

export const SAME_AS_HOUSE: RoomOwn = { walls: "style", paper: "style", floor: "style" };

/** How a room is done up when it's added, if not like the house: a
 *  bathroom is tiled and a sauna lined with wood. Changed like any other. */
export const ROOM_FITTED: Partial<Record<string, RoomOwn>> = {
  bathroom: { walls: "style", paper: "tiles", floor: "tiles" },
  sauna: { walls: "style", paper: "logs", floor: "planks" },
};

/** Swatch colours for the pickers. The room itself takes its colours from
 *  reading-room.css, which has a day and a night shade of each. */
export const WALL_SWATCHES: Record<Exclude<RoomWalls, "style">, string> = {
  cream: "#f1e5cd",
  sage: "#cfdcc4",
  sky: "#c9dcec",
  rose: "#efd2d0",
  lavender: "#dcd3ea",
  ochre: "#e6cc8f",
  slate: "#8c99a6",
  charcoal: "#4a4a50",
};
export const WOOD_SWATCHES: Record<Exclude<RoomWood, "style">, string> = {
  birch: "#d9bf91",
  oak: "#b98547",
  walnut: "#7d5233",
  mahogany: "#8a3b2a",
  ebony: "#3a2c26",
  grey: "#8d8a85",
};
export const FABRIC_SWATCHES: Record<Exclude<RoomFabric, "style">, string> = {
  crimson: "#9b3a43",
  forest: "#3f6e45",
  navy: "#34507e",
  mustard: "#c08f2c",
  plum: "#6d3b6e",
  teal: "#2f7a78",
  rose: "#c06a7c",
  grey: "#6b6f78",
};

export const COLOUR_LABELS: Record<string, string> = {
  style: "The style's own",
  cream: "Cream",
  sage: "Sage",
  sky: "Sky blue",
  rose: "Rose",
  lavender: "Lavender",
  ochre: "Ochre",
  slate: "Slate",
  charcoal: "Charcoal",
  birch: "Birch",
  oak: "Oak",
  walnut: "Walnut",
  mahogany: "Mahogany",
  ebony: "Ebony",
  grey: "Grey",
  crimson: "Crimson",
  forest: "Forest green",
  navy: "Navy",
  mustard: "Mustard",
  plum: "Plum",
  teal: "Teal",
};
