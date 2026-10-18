/**
 * Pictures for the bare walls of the reading room's rooms (Decorate ›
 * House › On the bare walls, lib/room-styles.ts: ROOM_PICTURES). The house
 * hangs them on the stretches of wall that the furniture leaves clear, in
 * turn with the windows (lib/room.ts: wallSpots), each frame centred on
 * the same line as the windows, so they share one band along every wall.
 *
 * Every kind comes in PICTURE_VIEWS pictures, used in turn along the house.
 * Each is drawn dot by dot on a little canvas, as the windows are
 * (room-windows.ts): light from the upper left, frames lit on their top
 * and left edges, and a faint shadow cast down and to the right. Pictures
 * hung on a cord show it, from a brass nail.
 */
import { paintingArt, type Art, type Paint, type Rect } from "@/components/room-art";
import { WINDOW_DROP, WINDOW_H } from "@/components/room-windows";
import type { RoomPictures } from "@/lib/room-styles";

/** Every picture, frame and cord and all, fits a box this size. */
export const PICTURE_W = 31;
export const PICTURE_H = 33;
/** How far under a room's ceiling the middle of every frame is: level
 *  with the middle of the windows. */
export const PICTURE_MID = WINDOW_DROP + WINDOW_H / 2;
export const PICTURE_VIEWS = 3;

/** A picture, with the rows of its cord and nail over the frame. */
export interface Picture extends Art {
  hang: number;
}

type Kind = Exclude<RoomPictures, "none" | "mixed">;
const KINDS: readonly Kind[] = ["paintings", "portraits", "prints", "maps", "photos"];

// ── The canvas ───────────────────────────────────────────────────────────

class Canvas {
  readonly base: (Paint | null)[];
  readonly over: (Paint | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.base = Array(w * h).fill(null);
    this.over = Array(w * h).fill(null);
  }

  private inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  at(x: number, y: number): Paint | null {
    return this.inside(x, y) ? this.base[y * this.w + x] : null;
  }

  dot(x: number, y: number, paint: Paint) {
    if (this.inside(x, y)) this.base[y * this.w + x] = paint;
  }

  fill(x: number, y: number, w: number, h: number, paint: Paint) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.dot(i, j, paint);
  }

  /** Text rows, one character a dot, painted by `key` ("." is left be),
   *  only where `keep` allows. */
  sprite(rows: readonly string[], ox: number, oy: number, key: Record<string, Paint>, keep?: (x: number, y: number) => boolean) {
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => key[ch] && (!keep || keep(ox + x, oy + y)) && this.dot(ox + x, oy + y, key[ch])),
    );
  }

  /** A see-through paint over the wall beside the picture. */
  shade(x: number, y: number, paint: Paint) {
    if (this.inside(x, y)) this.over[y * this.w + x] = paint;
  }

  rects(): Rect[] {
    return [...runs(this.base, this.w, this.h), ...runs(this.over, this.w, this.h)];
  }
}

/** Runs of one paint along each row, stacked where rows repeat. */
function runs(cells: readonly (Paint | null)[], w: number, h: number): Rect[] {
  const out: [number, number, number, number, Paint][] = [];
  let open = new Map<string, number>();
  for (let y = 0; y < h; y++) {
    const next = new Map<string, number>();
    for (let x = 0; x < w; ) {
      const paint = cells[y * w + x];
      let end = x + 1;
      while (end < w && cells[y * w + end] === paint) end++;
      if (paint) {
        const key = `${x},${end - x},${paint}`;
        const i = open.get(key);
        if (i === undefined) {
          next.set(key, out.length);
          out.push([x, y, end - x, 1, paint]);
        } else {
          out[i][3]++;
          next.set(key, i);
        }
      }
      x = end;
    }
    open = next;
  }
  return out;
}

/** A shadow on the wall down and to the right of everything drawn. */
function castShadow(c: Canvas) {
  for (let y = c.h - 1; y > 0; y--) {
    for (let x = c.w - 1; x > 0; x--) if (!c.at(x, y) && c.at(x - 1, y - 1)) c.shade(x, y, "wall-shadow");
  }
}

// ── Frames ───────────────────────────────────────────────────────────────

/** A gilt frame, its inside left for the picture. */
function gilt(c: Canvas, x: number, y: number, w: number, h: number) {
  c.fill(x, y, w, h, "brass-lo");
  c.fill(x + 1, y + 1, w - 2, h - 2, "brass");
  c.fill(x + 1, y + 1, w - 2, 1, "brass-hi");
  c.fill(x + 1, y + 1, 1, h - 2, "brass-hi");
  c.fill(x + 2, y + 2, w - 4, 1, "brass-lo");
  c.fill(x + 2, y + h - 3, w - 4, 1, "brass-hi");
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) c.dot(cx, cy, "brass-hi");
}

/** A plain wooden frame two dots wide. */
function wooden(c: Canvas, x: number, y: number, w: number, h: number) {
  c.fill(x, y, w, h, "wood-deep");
  c.fill(x + 1, y + 1, w - 2, h - 2, "wood");
  c.fill(x + 1, y + 1, w - 2, 1, "wood-hi");
  c.fill(x + 1, y + 1, 1, h - 2, "wood-hi");
}

/** A thin black frame round a white mount. */
function mounted(c: Canvas, x: number, y: number, w: number, h: number) {
  c.fill(x, y, w, h, "ink");
  c.fill(x + 1, y + 1, w - 2, h - 2, "paper");
}

/** A cord from a nail over the middle of the top `hang` rows to the
 *  frame's top, `spread` dots either side. */
function cord(c: Canvas, hang: number, spread: number) {
  const mid = Math.floor((c.w - 2) / 2);
  c.fill(mid, 0, 2, 1, "brass-hi");
  let was = -1;
  for (let y = 1; y < hang; y++) {
    const dx = Math.round((y / (hang - 1)) * spread);
    for (let d = was + 1; d <= dx; d++) {
      c.dot(mid - d, y, "ink");
      c.dot(mid + 1 + d, y, "ink");
    }
    was = dx;
  }
}

// ── Paintings ────────────────────────────────────────────────────────────

const STILL_LIFE_KEY: Record<string, Paint> = {
  r: "rose",
  R: "rose-lo",
  h: "rose-hi",
  y: "petal-gold",
  Y: "petal-gold-lo",
  w: "petal-white",
  g: "leaf-hi",
  G: "leaf",
  j: "leaf-lo",
  B: "delft",
  b: "delft-lo",
  T: "wood",
  t: "wood-hi",
  D: "wood-lo",
  a: "apple",
  A: "apple-hi",
};

/** Flowers in a blue jug and an apple, on a dark ground. 22 × 28. */
function stillLife(c: Canvas, x: number, y: number) {
  gilt(c, x, y, 22, 28);
  c.fill(x + 3, y + 3, 16, 22, "pic-ground");
  c.sprite(
    [
      "................",
      "......hr........",
      ".....hrrR...ww..",
      "..yy..rRR..wyw..",
      ".yYyy.GR...ww...",
      "..yY.gG..r..G...",
      "...j.Gj.hrR.G...",
      "..w.jGG..rR.j.y.",
      ".wyw.jG..Gj.jyYy",
      "..w..GjGGj.Gj.y.",
      "...G..GjG.GjG.j.",
      "....GjGGjGGj....",
      ".....bBBBBb.....",
      "......bBBb......",
      ".....bBBBBb.....",
      "....bBBwBBBb....",
      "....bBwBBBBb.aA.",
      "....bBBBBBBbaaa.",
      ".....bBBBBb..a..",
      "tttttttttttttttt",
      "TTTTTTTTTTTTTTTT",
      "DDDDDDDDDDDDDDDD",
    ],
    x + 3,
    y + 3,
    STILL_LIFE_KEY,
  );
}

const MOUNTAIN_KEY: Record<string, Paint> = {
  W: "marble-hi",
  m: "stone",
  M: "stone-lo",
  p: "pine",
  P: "pine-lo",
  "~": "sea",
  "-": "sea-lo",
  g: "leaf-hi",
  G: "leaf",
};

/** Snowy peaks over a lake among pines. 30 × 22. */
function mountains(c: Canvas, x: number, y: number) {
  gilt(c, x, y, 30, 22);
  c.fill(x + 3, y + 3, 24, 16, "art-sky");
  c.fill(x + 3, y + 3, 24, 4, "art-sky-hi");
  c.sprite(
    [
      "........................",
      "..............W.........",
      ".............WWm........",
      "......W.....WWmmm.......",
      ".....WWm...WmmmMmm......",
      "....WWmmm.mmmmMMmmm.....",
      "...mmmmmmmmmmMMMmmmmm...",
      "..mmmmMmmmmmMMMMmmmmmmm.",
      "gggggggggggggggggggggggg",
      "ggpgggggggggggggggggpggg",
      "gpppgg~~~~~~~~~~~~ggpppg",
      "pppppg~--~~~~~-~~~gpppPp",
      "pPpppg~~~~~-~~~~~~gppPPp",
      "gpPpgg~~-~~~~~~--~ggpPpg",
      "gggggggggggggggggggggggg",
      "GGGGGGGGGGGGGGGGGGGGGGGG",
    ],
    x + 3,
    y + 3,
    MOUNTAIN_KEY,
  );
}

/** The boat at sea, as in the study. 30 × 22. */
function seascape(c: Canvas, x: number, y: number) {
  for (const [rx, ry, rw, rh, p] of paintingArt("sea").rects) c.fill(x + rx, y + ry, rw, rh, p);
}

// ── Portraits ────────────────────────────────────────────────────────────

/** An oval gilt frame `w` × `h` and the inside of it, for clipping. */
function oval(c: Canvas, x: number, y: number, w: number, h: number) {
  const cx = x + (w - 1) / 2;
  const cy = y + (h - 1) / 2;
  const within = (px: number, py: number, inset: number) =>
    ((px - cx) / (w / 2 - inset)) ** 2 + ((py - cy) / (h / 2 - inset)) ** 2 <= 1;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (!within(px, py, 0)) continue;
      const lit = px - cx + (py - cy) * (w / h) < 0;
      if (!within(px, py, 1)) c.dot(px, py, "brass-lo");
      else if (!within(px, py, 2)) c.dot(px, py, lit ? "brass-hi" : "brass");
      else if (!within(px, py, 3)) c.dot(px, py, lit ? "brass-lo" : "brass-hi");
      else c.dot(px, py, "pic-ground");
    }
  }
  return (px: number, py: number) => within(px, py, 3);
}

const PORTRAIT_KEY: Record<string, Paint> = {
  k: "pic-hair",
  K: "pic-hair-hi",
  x: "marble-lo",
  X: "marble",
  h: "pic-skin-hi",
  s: "pic-skin",
  S: "pic-skin-lo",
  e: "ink",
  m: "rose-lo",
  w: "petal-white",
  W: "paper-lo",
  c: "ink",
  C: "spine-b",
  d: "rose-lo",
  D: "rose-deep",
  q: "rose",
  o: "cat-hi",
  O: "cat",
  l: "cat-lo",
  u: "cat-white",
  E: "cat-eye",
  n: "pet-nose",
};

const PORTRAITS: readonly (readonly string[])[] = [
  // A lady with her hair up and a string of pearls.
  [
    "................",
    "......kkkk......",
    ".....kkKkkk.....",
    "......kkkk......",
    ".....kkkkkk.....",
    "....kkKkkkkk....",
    "....kkhhhhkk....",
    "....khhsssSk....",
    "....khesseSk....",
    "....khssssSk....",
    "....kkhsSssk....",
    ".....khmmsk.....",
    ".....kSssSk.....",
    "......sSSs......",
    "......hsss......",
    ".....wwwwww.....",
    "...dqqqwwqqd....",
    "..dqqqqqqqqqd...",
    ".ddqqqqqqqqqdd..",
    ".dddqqqqqqqddd..",
    "dddddqqqqqDdddd.",
    "ddddddddDDDDdddd",
  ],
  // A gentleman with grey whiskers and a white cravat.
  [
    "................",
    "................",
    "......xxxx......",
    ".....xXXXXx.....",
    "....xXhhhhSx....",
    "....xhhsssSx....",
    "....xhssssSx....",
    "....Xhesses.....",
    "....XhssssSs....",
    "....XxhsSssx....",
    "....XxxsssxX....",
    ".....XxmmxXx....",
    ".....XXxxXX.....",
    "......XXXX......",
    "......wwww......",
    "....cCwwwwCc....",
    "...cCCcwwcCCc...",
    "..cCCCcwwcCCCc..",
    ".ccCCCccccCCCcc.",
    ".cccCCccccCCccc.",
    "ccccccccccccccc.",
    "cccccccccccccccc",
  ],
  // The cat of the house, in a ruff.
  [
    "................",
    "................",
    "...O........O...",
    "...OO......OO...",
    "...OoO....OoO...",
    "...OOOOOOOOOO...",
    "..OOoooOOOOOOO..",
    "..OOOOOOOOOOOO..",
    "..OOeEOOOOeEOO..",
    "..OOOOOOOOOOlO..",
    "..OOOOOnnOOOlO..",
    "...OOOuuuuOOl...",
    "....OOuuuuOl....",
    ".....OOOOOl.....",
    "...wwwwwwwwww...",
    "..wWwWwWwWwWww..",
    "...wwwwwwwwww...",
    "....OOOOOOOl....",
    "...OOOOOOOOOl...",
    "..OOOOOOOOOOOl..",
    "..OOOOOOOOOOOl..",
    ".OOOOOOOOOOOOll.",
  ],
];

/** A portrait in an oval frame. 20 × 26. */
function portrait(c: Canvas, x: number, y: number, view: number) {
  const keep = oval(c, x, y, 20, 26);
  c.sprite(PORTRAITS[view], x + 2, y + 3, PORTRAIT_KEY, keep);
}

// ── Botanical prints ─────────────────────────────────────────────────────

const PRINT_KEY: Record<string, Paint> = {
  g: "leaf-hi",
  G: "leaf",
  j: "leaf-lo",
  r: "rose",
  R: "rose-lo",
  h: "rose-hi",
  a: "apple",
  A: "apple-hi",
  w: "daisy",
  W: "paper-lo",
  y: "petal-gold",
};

const PRINTS: readonly (readonly string[])[] = [
  // A fern frond.
  [
    "....g.....",
    "...gGj....",
    "..g.Gj.j..",
    "...gGjj...",
    ".gg.Gj.jj.",
    "..ggGjjj..",
    "gg..Gj..jj",
    ".gggGjjjj.",
    "g...Gj...j",
    ".ggGGjjjj.",
    "gg..Gj..jj",
    ".gggGjjj..",
    "....Gj....",
    "....j.....",
    "...j......",
  ],
  // A tulip.
  [
    "..........",
    "...h.rR...",
    "...hrrrR..",
    "...hrrRR..",
    "...rrrRR..",
    "....rRR...",
    ".....G....",
    ".....G....",
    ".g...G....",
    ".gG..G..j.",
    "..gG.G.jj.",
    "..gGGGjj..",
    "...gGGj...",
    "....GG....",
    ".....j....",
  ],
  // A toadstool in the grass.
  [
    "..........",
    "..........",
    "..........",
    "...aaaa...",
    "..aAwaaa..",
    ".aAaaawaa.",
    ".awaaaaaa.",
    "aaaaawaaaa",
    "..WwwwwW..",
    "...wwwW...",
    "...wwwW...",
    "...wwwW...",
    "..gwwwWj..",
    ".gGgGjGjj.",
    "gGgGgjGjGj",
  ],
];

/** A pressed plant in a thin frame, with its name pencilled under it.
 *  18 × 24. */
function print(c: Canvas, x: number, y: number, view: number) {
  wooden(c, x, y, 18, 24);
  c.fill(x + 2, y + 2, 14, 20, "paper");
  // The plate's edge pressed into the paper.
  c.fill(x + 3, y + 3, 12, 1, "paper-lo");
  c.fill(x + 3, y + 3, 1, 15, "paper-lo");
  c.sprite(PRINTS[view], x + 4, y + 3, PRINT_KEY);
  c.fill(x + 6, y + 19, 6, 1, "paper-lo");
}

// ── Maps and charts ──────────────────────────────────────────────────────

const MAP_KEY: Record<string, Paint> = {
  "~": "sea",
  "-": "sea-lo",
  l: "paper",
  L: "paper-lo",
  g: "leaf",
  k: "ink",
  r: "apple",
  y: "petal-gold",
  w: "petal-white",
  b: "delft-lo",
};

const MAPS: readonly { ground: Paint; rows: readonly string[] }[] = [
  // An island and a coast, a route between them and a compass rose.
  {
    ground: "paper",
    rows: [
      "...k....--~~~~~~~~~~~~~~~-",
      "..kkk...-~~~~~~~~~~~~~~~--",
      ".k.r.k..-~~~LLL~~~~~~~~~-L",
      "kkrrrkk.-~~LlllL~~~~~~~-Ll",
      ".k.r.k...-~LlgllL~~~~~-Lll",
      "..kkk....-~~LllL~~~~~~-Lgl",
      "...k.....-~~~LL~~r~~~~-Lll",
      "..........-~~~~~~~r~~~-Lll",
      "..........-~~~~~~~~r~~~-Ll",
      "...LLL....-~~~~~~~~~r~~-Ll",
      "..LlllL...-~~~~~~~~~~r~-Ll",
      ".LllgllL..-~~~~~~~~~~~r-Ll",
      "LlllllllL.-~~~~~~~~~~-LLll",
      "llllgllllL-~~~~~~~~~-Lllll",
      "lllllllllL-~~~~~~~-LLlllgl",
      "llllllllllL-~~~~~-Llllllll",
      "lllgllllllL-~~~~-Llllgllll",
      "lllllllllllL----Lllllllll.",
    ],
  },
  // The stars, with the Plough joined up.
  {
    ground: "pic-navy",
    rows: [
      "..w...........y.......w...",
      "........w.................",
      "...y.....bbbbw........y...",
      "........b.................",
      ".w.....w.......w....w.....",
      "......b.........b.........",
      "....bw...........bw.......",
      "...b.......w.......b..y...",
      "..yb................bw....",
      "..........y..........b....",
      ".w....................bw..",
      "..............w...........",
      ".....y.........b..........",
      "..............b.b.....w...",
      "........w....w...y........",
      "...w.............b........",
      "..................w...y...",
      "..........y...............",
    ],
  },
  // The world in two halves.
  {
    ground: "paper",
    rows: [
      "...........L..L...........",
      "....-~~~~-..LL...-~~~~-...",
      "..-~~ggg~~-.....-~~~gg~~-.",
      ".-~~gggg~~~-...-~gggggg~~-",
      ".~~~ggg~~~~~...~~ggggggg~~",
      "-~~~~gg~~~~~-.-~~ggggg~~~~",
      "~~~~~~g~~~~~~.~~~gggg~~~~~",
      "~~~~~~gg~~~~~.~~~~gg~~~g~~",
      "~~~~~~ggg~~~~.~~~~gg~~ggg~",
      "~~~~~~gggg~~~.~~~~~g~~~gg~",
      "-~~~~~ggg~~~-.-~~~~~~~~~~-",
      ".~~~~~gg~~~~...~~~~~~~gg~.",
      ".-~~~~g~~~~-...-~~~~~~~~-.",
      "..-~~~~~~~-.....-~~~~~~-..",
      "....-~~~-.........-~~-....",
      "..........................",
      "......LLLLLLLLLLLLLL......",
      "..........................",
    ],
  },
];

/** A map or chart in a wooden frame. 30 × 22. */
function chart(c: Canvas, x: number, y: number, view: number) {
  const { ground, rows } = MAPS[view];
  wooden(c, x, y, 30, 22);
  c.fill(x + 2, y + 2, 26, 18, ground);
  c.sprite(rows, x + 2, y + 2, MAP_KEY);
}

// ── Photographs ──────────────────────────────────────────────────────────

const PHOTO_KEY: Record<string, Paint> = {
  h: "pic-sepia-hi",
  s: "pic-sepia",
  S: "pic-sepia-lo",
  D: "pic-sepia-deep",
};

/** Little sepia photographs, each `w` wide, to fill a mount. */
const SNAPS: Record<string, readonly string[]> = {
  sitter: ["hhhhhhhh", "hhhSShhh", "hhSDDShh", "hhSssShh", "hhhSShhh", "hSSDDSSh", "SDDDDDDS", "DDDDDDDD"],
  house: ["hhhhhhhhhh", "hhhhSShhhh", "hhhSDDShhh", "hhSDDDDShh", "hhSshsSShh", "hhSsSsSShh", "ssssssssss", "SSSSSSSSSS"],
  dog: ["hhhhhh", "hShhSh", "hSssSh", "hsDsDh", "hssssh", "hhSShh"],
  sea: ["hhhhhhhh", "hhhhhDhh", "hhhhDDhh", "hhhDsDhh", "ssssssss", "SsSSsSSs"],
  tree: ["hhhhhh", "hhSShh", "hSDDSh", "hSDDSh", "hhDShh", "sssDss", "SSSSSS"],
};

/** Where each photograph in a group hangs, its frame's size, and which. */
const GROUPS: readonly (readonly [x: number, y: number, w: number, h: number, snap: keyof typeof SNAPS][])[] = [
  [
    [0, 0, 12, 14, "sitter"],
    [15, 2, 14, 12, "house"],
    [3, 17, 10, 10, "dog"],
    [16, 17, 12, 10, "sea"],
  ],
  [
    [0, 3, 14, 12, "house"],
    [17, 0, 12, 14, "sitter"],
    [2, 18, 12, 10, "sea"],
    [18, 17, 10, 11, "tree"],
  ],
  [
    [0, 0, 10, 11, "tree"],
    [13, 0, 12, 14, "sitter"],
    [0, 14, 10, 10, "dog"],
    [13, 17, 14, 12, "house"],
  ],
];

/** A group of photographs in black frames on white mounts. */
function photos(c: Canvas, x: number, y: number, view: number) {
  for (const [px, py, w, h, snap] of GROUPS[view]) {
    mounted(c, x + px, y + py, w, h);
    const rows = SNAPS[snap];
    const sx = x + px + Math.floor((w - rows[0].length) / 2);
    const sy = y + py + Math.floor((h - rows.length) / 2);
    c.sprite(rows, sx, sy, PHOTO_KEY);
  }
}

// ── The pictures ─────────────────────────────────────────────────────────

/** Each kind's pictures: its size, whether it hangs on a cord, and how it
 *  is drawn with its top left at x, y. */
const DRAW: Record<Kind, readonly { w: number; h: number; cord: boolean; draw: (c: Canvas, x: number, y: number) => void }[]> = {
  paintings: [
    { w: 22, h: 28, cord: true, draw: stillLife },
    { w: 30, h: 22, cord: true, draw: mountains },
    { w: 30, h: 22, cord: true, draw: seascape },
  ],
  portraits: [0, 1, 2].map((v) => ({ w: 20, h: 26, cord: true, draw: (c: Canvas, x: number, y: number) => portrait(c, x, y, v) })),
  prints: [0, 1, 2].map((v) => ({ w: 18, h: 24, cord: true, draw: (c: Canvas, x: number, y: number) => print(c, x, y, v) })),
  maps: [0, 1, 2].map((v) => ({ w: 30, h: 22, cord: false, draw: (c: Canvas, x: number, y: number) => chart(c, x, y, v) })),
  photos: GROUPS.map((group, v) => ({
    w: Math.max(...group.map(([px, , w]) => px + w)),
    h: Math.max(...group.map(([, py, , h]) => py + h)),
    cord: false,
    draw: (c: Canvas, x: number, y: number) => photos(c, x, y, v),
  })),
};

const HANG = 4;

function pictureArt(kind: Kind, view: number): Picture {
  const { w, h, cord: corded, draw } = DRAW[kind][view];
  const hang = corded ? HANG : 0;
  const c = new Canvas(w + 1, h + hang + 1);
  if (corded) cord(c, hang, Math.floor(w / 5));
  draw(c, 0, hang);
  castShadow(c);
  return { w: c.w, h: c.h, hang, rects: c.rects() };
}

const PICTURES = new Map<string, Picture>();

/** The `n`th picture of a kind along the house, drawn once. A mix takes
 *  each kind in turn. */
export function pictureFor(kind: Exclude<RoomPictures, "none">, n: number): Picture {
  const turn = ((n % 15) + 15) % 15;
  const k = kind === "mixed" ? KINDS[turn % KINDS.length] : kind;
  const view = (kind === "mixed" ? Math.floor(turn / KINDS.length) : turn) % PICTURE_VIEWS;
  const key = `${k}-${view}`;
  if (!PICTURES.has(key)) PICTURES.set(key, pictureArt(k, view));
  return PICTURES.get(key)!;
}

/** Where a picture's top left goes, from the left of the box it hangs in
 *  and the room's ceiling, so its frame is centred on PICTURE_MID. */
export function pictureAt(p: Picture): { dx: number; dy: number } {
  return { dx: Math.floor((PICTURE_W - p.w) / 2), dy: PICTURE_MID - p.hang - Math.floor((p.h - p.hang) / 2) };
}

/** A tile's picture for Decorate: the pictures on a piece of wall, `w` ×
 *  `h`. "none" is the bare wall; a mix shows two kinds side by side. */
export function pictureSample(kind: RoomPictures, w: number, h: number): Art {
  const R: Rect[] = [[0, 0, w, h, "wall"]];
  const hangs = kind === "none" ? [] : kind === "mixed" ? [pictureFor("portraits", 0), pictureFor("prints", 1)] : [pictureFor(kind, 0)];
  const total = hangs.reduce((sum, p) => sum + p.w, 0) + 2 * (hangs.length - 1);
  let x = Math.floor((w - total) / 2);
  for (const p of hangs) {
    const y = Math.floor((h - p.h) / 2);
    R.push(...p.rects.map(([rx, ry, rw, rh, paint]): Rect => [rx + x, ry + y, rw, rh, paint]));
    x += p.w + 2;
  }
  return { w, h, rects: R };
}
