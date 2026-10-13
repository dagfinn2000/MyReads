/**
 * The pixel art for the reading room (components/reading-room.tsx): the
 * house, the bookcases and the furniture, drawn in code as rows of
 * coloured rectangles, one unit per dot.
 *
 * Small, shapely things (the cat, a plant, the flames) are drawn as text
 * grids, one character per dot, and turned into rectangles by `grid`.
 * Big, regular things (the house, a bookcase) are built from rectangles
 * directly. Each rectangle names a paint, not a colour: paints are classes
 * (`rp-wood`, …) whose colours live in reading-room.css, so the whole room
 * changes between day (light themes) and night (dark themes) in CSS alone.
 */

export type Paint = string;
export type Rect = readonly [x: number, y: number, w: number, h: number, paint: Paint];

export interface Art {
  w: number;
  h: number;
  rects: Rect[];
}

/** What each character in a text grid paints. "." and " " are empty. */
const KEY: Record<string, Paint> = {
  w: "wood-hi",
  W: "wood",
  d: "wood-lo",
  D: "wood-deep",
  s: "stone-hi",
  S: "stone",
  t: "stone-lo",
  T: "stone-deep",
  k: "soot",
  F: "flame-1",
  f: "flame-2",
  r: "flame-3",
  e: "ember",
  b: "brass-hi",
  B: "brass",
  n: "brass-lo",
  c: "chair-hi",
  C: "chair",
  x: "chair-lo",
  X: "chair-deep",
  g: "leaf-hi",
  G: "leaf",
  j: "leaf-lo",
  p: "pot-hi",
  P: "pot",
  q: "pot-lo",
  o: "cat-hi",
  O: "cat",
  h: "cat-lo",
  H: "cat-deep",
  u: "cat-white",
  l: "shade-hi",
  L: "shade",
  m: "shade-lo",
  y: "paper",
  Y: "paper-lo",
  a: "glass-hi",
  A: "glass",
  v: "glass-lo",
  "~": "sea",
  "-": "sea-lo",
  i: "flower",
  E: "lamp-green",
  K: "ink",
  "1": "book",
  "2": "book-lo",
  U: "cushion",
  V: "cushion-lo",
  z: "steam",
  "@": "sky-body",
  "%": "cloud",
  "^": "hill",
  $: "art-sun",
  "3": "spine-a",
  "4": "spine-b",
};

/** A text grid as rectangles: each run of one character on a row becomes
 *  one rectangle. `ox`/`oy` shift it. */
export function grid(rows: readonly string[], ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const ch = line[x];
      let end = x + 1;
      while (end < line.length && line[end] === ch) end++;
      const paint = KEY[ch];
      if (paint) out.push([ox + x, oy + y, end - x, 1, paint]);
      x = end;
    }
  });
  return out;
}

function art(rows: readonly string[]): Art {
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length, rects: grid(rows) };
}

/**
 * An SVG of rectangles, `scale` screen pixels to a dot. crispEdges keeps
 * every edge on a whole pixel, so nothing is blurred.
 */
export function Sprite({
  art: a,
  scale,
  className,
  style,
  children,
}: {
  art: Art;
  scale: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <svg
      width={a.w * scale}
      height={a.h * scale}
      viewBox={`0 0 ${a.w} ${a.h}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={a.rects} />
      {children}
    </svg>
  );
}

export function Rects({ rects, className }: { rects: readonly Rect[]; className?: string }) {
  const body = rects.map(([x, y, w, h, paint], i) => (
    <rect key={i} x={x} y={y} width={w} height={h} className={`rp-${paint}`} />
  ));
  return className ? <g className={className}>{body}</g> : <>{body}</>;
}

// ── Bookcase ──────────────────────────────────────────────────────────────
// 46 × 125: a moulded crown, five shelves on a dark back panel, a plinth.
// Spines are links laid over it by the room, standing on the boards.

export function bookcaseArt(): Art {
  const R: Rect[] = [];
  R.push([3, 5, 40, 115, "case-back"]);
  for (let x = 13; x < 43; x += 10) R.push([x, 5, 1, 115, "case-seam"]);
  R.push([0, 5, 1, 115, "wood-deep"], [1, 5, 1, 115, "wood-hi"], [2, 5, 1, 115, "wood"]);
  R.push([43, 5, 1, 115, "wood"], [44, 5, 1, 115, "wood-lo"], [45, 5, 1, 115, "wood-deep"]);
  R.push([0, 0, 46, 1, "wood-deep"], [0, 1, 46, 1, "wood-hi"], [0, 2, 46, 1, "wood"]);
  R.push([0, 3, 46, 1, "wood-lo"]);
  for (let x = 2; x < 44; x += 3) R.push([x, 3, 1, 1, "wood-deep"]);
  R.push([0, 4, 46, 1, "wood-deep"]);
  for (let i = 0; i < 5; i++) {
    const top = 5 + 23 * i;
    R.push([3, top, 40, 2, "case-shadow"]);
    const board = top + 20;
    R.push([3, board, 40, 1, "wood-hi"], [3, board + 1, 40, 1, "wood"], [3, board + 2, 40, 1, "wood-lo"]);
  }
  R.push([0, 120, 46, 1, "wood-deep"], [0, 121, 46, 3, "wood"], [1, 121, 44, 1, "wood-hi"]);
  R.push([5, 123, 36, 1, "wood-lo"], [0, 124, 46, 1, "wood-deep"]);
  return { w: 46, h: 125, rects: R };
}

// ── Hearth: fireplace, armchair, side table, floor lamp ──────────────────

/** 44 × 48. The flames and logs are separate (FLAMES_A/B, LOGS) so they
 *  can flicker. */
export function fireplaceArt(): Art {
  const R: Rect[] = [];
  // Stone surround, in courses of blocks with staggered joints.
  R.push([3, 4, 38, 41, "stone"]);
  for (let row = 0; row < 8; row++) {
    const y = 5 + row * 5;
    R.push([3, y, 38, 1, "stone-hi"]);
    R.push([3, y + 4, 38, 1, "stone-lo"]);
    for (let x = 3 + (row % 2 ? 4 : 0); x < 41; x += 8) R.push([x, y, 1, 4, "stone-lo"]);
  }
  R.push([3, 4, 1, 41, "stone-deep"], [40, 4, 1, 41, "stone-deep"]);
  // The arched opening with its ring of stones and a keystone.
  R.push([14, 18, 16, 1, "stone-deep"], [12, 19, 20, 1, "stone-deep"], [11, 20, 22, 25, "stone-deep"]);
  R.push([15, 19, 14, 1, "soot"], [13, 20, 18, 1, "soot"], [12, 21, 20, 24, "soot"]);
  R.push([12, 39, 20, 6, "ember"]);
  R.push([20, 15, 4, 4, "stone-hi"], [20, 18, 4, 1, "stone-deep"], [23, 15, 1, 3, "stone-lo"]);
  // Fire irons: a grate in front of the logs.
  R.push([13, 42, 18, 1, "ink"], [14, 43, 1, 2, "ink"], [29, 43, 1, 2, "ink"]);
  for (let x = 15; x < 30; x += 3) R.push([x, 40, 1, 2, "ink"]);
  // Mantel shelf on two corbels.
  R.push([0, 0, 44, 1, "wood-hi"], [0, 1, 44, 2, "wood"], [0, 3, 44, 1, "wood-lo"]);
  R.push([0, 0, 1, 4, "wood-deep"], [43, 0, 1, 4, "wood-deep"], [4, 4, 36, 1, "wood-deep"]);
  R.push([4, 5, 3, 2, "wood-lo"], [37, 5, 3, 2, "wood-lo"], [5, 7, 1, 1, "wood-lo"], [38, 7, 1, 1, "wood-lo"]);
  // Hearthstone.
  R.push([0, 45, 44, 1, "stone-hi"], [0, 46, 44, 1, "stone"], [0, 47, 44, 1, "stone-lo"]);
  return { w: 44, h: 48, rects: R };
}

/** Two frames of flames, swapped to flicker. 14 × 10, over the logs. */
export const FLAMES_A = grid([
  "......r.......",
  ".....rr...r...",
  "..r..rfr..rr..",
  "..rr.rffr.rfr.",
  ".rfr.rfFfrrfr.",
  ".rffrrfFFfrffr",
  "rffFffFFFffFfr",
  "rfFFfFFFFFfFfr",
  "rfFFFFFFFFFFfr",
  ".rfFFFFFFFFfr.",
]);
export const FLAMES_B = grid([
  "........r.....",
  "...r...rr.....",
  "..rr..rfr..r..",
  ".rfr..rffr.rr.",
  ".rfrr.rfFfrfr.",
  "rffrrrfFFfrffr",
  "rfFffFFFFffFfr",
  "rfFFfFFFFfFFfr",
  "rfFFFFFFFFFFfr",
  ".rfFFFFFFFFfr.",
]);
export const LOGS = grid([
  ".dDDDDDDDDDDd.",
  "dWWwWWdWWwWWWd",
  "DddddDDddddddD",
]);

export const CANDLESTICK = art([".F.", ".f.", ".y.", ".y.", ".Y.", "bBn", ".B.", ".B.", "bBn"]);

export const MANTEL_CLOCK = art([
  "..nBBn..",
  ".nByyBn.",
  "nByyyyBn",
  "nByKyyBn",
  "nByKKyBn",
  "nByyyyBn",
  "nBBBBBBn",
  ".n....n.",
]);

/** A small picture in a gilt frame, 30 × 22: hills and a tree over the
 *  fireplace, or a sailing boat at sea in the study. */
export function paintingArt(scene: "hills" | "sea"): Art {
  const R: Rect[] = [];
  R.push([0, 0, 30, 22, "brass-lo"], [1, 1, 28, 20, "brass"], [1, 1, 28, 1, "brass-hi"], [1, 1, 1, 20, "brass-hi"]);
  R.push([3, 3, 24, 16, "art-sky"]);
  R.push([3, 3, 24, 4, "art-sky-hi"]);
  if (scene === "hills") {
    R.push(...grid(["....$$$....", "...$$$$$...", "....$$$...."], 17, 5));
    R.push(...grid([
      ".......GGGG..........GG.",
      "....GGGGGGGGG.....GGGGGG",
      "..GGGGGGGGGGGGGGGGGGGGGG",
      "GGGGGGGGGGGGGGGGGGGGGGGG",
      "jjjjjjjjjjjjjjjjjjjjjjjj",
      "jjjjjjjjjjjjjjjjjjjjjjjj",
    ], 3, 13));
    R.push(...grid(["..jj..", ".jjjj.", "jjgjjj", ".jjjj.", "..d...", "..d..."], 7, 9));
  } else {
    R.push(...grid(["..$$..", ".$$$$.", "..$$.."], 6, 5));
    R.push(...grid([
      "~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~-~~~~~~-~~~~~~~-~~~~~~",
      "~~~~~~-~~~~~~~-~~~~~~~-~",
      "-~~~-~~~~-~~~~~~-~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~-~~~",
      "~-~~~~~~-~~~~-~~~~~~~~~~",
    ], 3, 13));
    R.push(...grid([
      "....y....",
      "...yy....",
      "..yyyK...",
      ".yyyyKy..",
      "yyyyyKyy.",
      "dWWWWWWWd",
      ".dddddddd",
    ], 14, 7));
  }
  R.push([2, 2, 26, 1, "brass-lo"], [2, 19, 26, 1, "brass-hi"]);
  return { w: 30, h: 22, rects: R };
}

/** A tufted wingback armchair, 29 × 31. */
export function armchairArt(): Art {
  const R: Rect[] = [];
  // Back.
  R.push([5, 0, 19, 1, "chair-deep"], [4, 1, 1, 17, "chair-deep"], [24, 1, 1, 17, "chair-deep"]);
  R.push([5, 1, 19, 17, "chair"], [5, 1, 19, 1, "chair-hi"], [5, 2, 1, 16, "chair-hi"], [23, 2, 1, 16, "chair-lo"]);
  for (const [x, y] of [[9, 5], [14, 5], [19, 5], [11, 9], [17, 9], [9, 13], [14, 13], [19, 13]]) {
    R.push([x, y, 1, 1, "chair-lo"]);
  }
  // Arms, rolled at the top.
  for (const side of [0, 22]) {
    R.push([side + 1, 10, 5, 1, "chair-deep"], [side, 11, 1, 16, "chair-deep"], [side + 6, 11, 1, 16, "chair-deep"]);
    R.push([side + 1, 11, 5, 16, "chair"], [side + 1, 11, 5, 1, "chair-hi"], [side + 1, 12, 1, 15, "chair-hi"]);
    R.push([side + 5, 12, 1, 15, "chair-lo"]);
    R.push([side + 2, 12, 3, 1, "chair-lo"], [side + 2, 13, 1, 1, "chair-lo"], [side + 4, 13, 1, 1, "chair-lo"]);
    R.push([side + 2, 14, 3, 1, "chair-lo"]);
  }
  // Seat cushion and the front rail.
  R.push([7, 17, 15, 1, "chair-hi"], [7, 18, 15, 2, "chair"], [7, 20, 15, 1, "chair-lo"]);
  R.push([7, 21, 15, 1, "chair-deep"], [7, 22, 15, 4, "chair"], [7, 22, 15, 1, "chair-lo"]);
  R.push([11, 23, 1, 3, "chair-lo"], [17, 23, 1, 3, "chair-lo"]);
  R.push([0, 26, 29, 1, "chair-deep"]);
  // Turned legs.
  R.push([2, 27, 2, 2, "wood-lo"], [25, 27, 2, 2, "wood-lo"], [2, 29, 1, 2, "wood-deep"], [26, 29, 1, 2, "wood-deep"]);
  return { w: 29, h: 31, rects: R };
}

/** The cat, asleep in a curl, 13 × 7. Its tail tip flicks (CAT_TAIL). */
export const CAT = art([
  ".H.H.........",
  "HoHoH..HHHH..",
  "HOOOHHHOOOOH.",
  "HOHOOOoOOOOOH",
  "HuOOOOOOOOhOH",
  ".HuuOhhhhhhOH",
  "..HHHHHHHHHH.",
]);
export const CAT_TAIL = grid(["..HH", ".HhH", "HhH.", "HH.."], 11, 1);

/** Round side table, 12 × 18. */
export const SIDE_TABLE = art([
  "wwwwwwwwwwww",
  "WWWWWWWWWWWW",
  ".dddddddddd.",
  "..DDDDDDDD..",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  "....wWWd....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  "....wWdd....",
  "...dWWWdd...",
  "..dD....Dd..",
  ".DD......DD.",
]);
export const TEACUP = art(["yyyy.", "yyyyY", "Yyyy.", "YYYYY"]);
export const STEAM = [grid(["z.", ".z", "z."]), grid([".z", "z.", ".z"])];
/** The book being read, open on the table, in its spine colour. */
export const OPEN_BOOK = art([".yyy.yyy.", "yyyyYyyyy", "211111112"]);

/** Floor lamp, 12 × 60. */
export function floorLampArt(): Art {
  const R: Rect[] = grid([
    "...mmmmmm...",
    "..mllllllm..",
    "..mlLLLLLm..",
    ".mlLLLLLLLm.",
    ".mlLLLLLLLm.",
    ".mlLLLLLLLm.",
    "mlLLLLLLLLLm",
    "mlLLLLLLLLLm",
    "mmmmmmmmmmmm",
    "....yFFy....",
  ]);
  R.push([5, 10, 1, 46, "brass"], [6, 10, 1, 46, "brass-lo"], [4, 30, 4, 1, "brass-hi"], [4, 31, 4, 1, "brass-lo"]);
  R.push([8, 9, 1, 5, "brass-lo"], [8, 14, 1, 1, "brass-hi"]);
  R.push([4, 56, 4, 1, "brass"], [3, 57, 6, 1, "brass-lo"], [2, 58, 8, 2, "ink"]);
  return { w: 12, h: 60, rects: R };
}

/** A rug with a fringe, `w` wide, lying on the floor in front. */
export function rugArt(w: number): Art {
  const R: Rect[] = [];
  R.push([0, 0, w, 1, "rug-fringe"]);
  R.push([1, 1, w - 2, 3, "rug"]);
  for (let x = 3; x < w - 3; x += 4) R.push([x, 2, 2, 1, "rug-2"]);
  R.push([1, 1, w - 2, 1, "rug-3"], [1, 3, w - 2, 1, "rug-3"]);
  for (let x = 0; x < w; x += 2) R.push([x, 4, 1, 1, "rug-fringe"]);
  return { w, h: 5, rects: R };
}

// ── Upper floors ─────────────────────────────────────────────────────────

/** A sash window between curtains, 46 × 52. Day or night shows through it
 *  (the sky paints follow the theme). */
export function windowArt(): Art {
  const R: Rect[] = [];
  const fx = 6;
  // Frame and glass.
  R.push([fx, 2, 34, 44, "wood-deep"], [fx + 1, 3, 32, 42, "wood"]);
  R.push([fx + 2, 4, 30, 40, "sky"], [fx + 2, 4, 30, 14, "sky-hi"]);
  // Moon or sun, a cloud, stars, far hills.
  R.push(...grid([".@@@.", "@@@@@", "@@@@@", "@@@@@", ".@@@."], fx + 6, 8));
  R.push(...grid(["..%%%....", ".%%%%%%..", "%%%%%%%%%"], fx + 18, 12));
  for (const [x, y] of [[4, 5], [14, 7], [25, 5], [29, 16], [20, 20], [3, 24], [11, 17]]) {
    R.push([fx + x, y, 1, 1, "star"]);
  }
  R.push(...grid([
    ".........^^^^............^^^^.",
    "......^^^^^^^^^^.....^^^^^^^^^",
    "...^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
  ], fx + 2, 40));
  // Glazing bars and a little shine.
  R.push([fx + 16, 4, 2, 40, "wood"], [fx + 2, 23, 30, 2, "wood"], [fx + 16, 4, 1, 40, "wood-hi"]);
  R.push([fx + 4, 6, 1, 3, "glass-shine"], [fx + 5, 5, 1, 2, "glass-shine"], [fx + 20, 27, 1, 3, "glass-shine"], [fx + 21, 26, 1, 2, "glass-shine"]);
  // Sill.
  R.push([fx - 2, 46, 38, 1, "wood-hi"], [fx - 2, 47, 38, 1, "wood"], [fx - 1, 48, 36, 1, "wood-deep"]);
  // Rod and curtains, gathered by tie-backs.
  R.push([0, 0, 46, 1, "brass"], [0, 1, 46, 1, "brass-lo"], [0, 0, 2, 2, "brass-hi"], [44, 0, 2, 2, "brass-hi"]);
  for (const [x0, dir] of [[1, 1], [37, -1]] as const) {
    for (let y = 1; y < 52; y++) {
      // Narrow at the tie-back, full above and below it.
      const width = y < 26 ? 8 - Math.floor(y / 9) : y < 30 ? 4 : Math.min(9, 4 + Math.floor((y - 30) / 4));
      const x = dir === 1 ? x0 : x0 + 8 - width;
      R.push([x, y, width, 1, "curtain"]);
      R.push([dir === 1 ? x : x + width - 1, y, 1, 1, "curtain-lo"]);
      if (width > 4) R.push([x + Math.floor(width / 2), y, 1, 1, dir === 1 ? "curtain-hi" : "curtain-lo"]);
    }
    R.push([dir === 1 ? x0 : x0 + 4, 26, 5, 2, "brass"]);
  }
  return { w: 46, h: 52, rects: R };
}

/** A cushioned window seat, 40 × 21. */
export function benchArt(): Art {
  const R: Rect[] = [];
  // Two cushions leaning at the ends, then the long seat cushion.
  R.push(...grid([".UUUUU.", "UUUUUUV", "UUUUUUV", "UUUUUUV", "VUUUUVV"], 3, 0));
  R.push(...grid([".UUUUU.", "VUUUUUU", "VUUUUUU", "VUUUUUU", "VVUUUUV"], 30, 0));
  R.push([0, 5, 40, 1, "cushion-hi"], [0, 6, 40, 2, "cushion"], [0, 8, 40, 1, "cushion-lo"]);
  // The box seat with two panels.
  R.push([0, 9, 40, 1, "wood-hi"], [0, 10, 40, 10, "wood"], [0, 20, 40, 1, "wood-deep"]);
  R.push([0, 9, 1, 12, "wood-deep"], [39, 9, 1, 12, "wood-deep"]);
  for (const x of [3, 21]) {
    R.push([x, 12, 16, 1, "wood-lo"], [x, 12, 1, 6, "wood-lo"], [x + 1, 17, 15, 1, "wood-hi"], [x + 15, 13, 1, 5, "wood-hi"]);
  }
  return { w: 40, h: 21, rects: R };
}

/** A tall potted plant, 16 × 34. */
export const PLANT = art([
  "......g.........",
  ".....gGg....g...",
  "....gGGj...gGg..",
  ".g..GGjj..gGGGj.",
  "gGg.GGjG.gGGjjj.",
  "GGGgGjGG.GGjGj..",
  "GjGGGGjGgGjGG...",
  ".GjjGGGjGGGGj.g.",
  "..GGjGGGGjGj.gGg",
  ".gGGGjGGGGG.gGGj",
  "gGGjGGGjGjGgGGj.",
  "GGjj.GjGGGGGjj..",
  ".jj..GGjGjGG.g..",
  "..g..jGGGjj.gGg.",
  ".gGg..jGGj.gGjj.",
  "gGGjj..jj.gGj...",
  ".jj.j..dd.jj....",
  "......dd........",
  ".......d........",
  ".......d........",
  "...pPPPPPPPPq...",
  "..pPPPPPPPPPPq..",
  "..qqqqqqqqqqqq..",
  "...pPPPPPPPPq...",
  "...pPPPPPPPPq...",
  "...pPPPPPPPPq...",
  "...pPPPPPPPPq...",
  "....pPPPPPPq....",
  "....pPPPPPPq....",
  "....pPPPPPPq....",
  "....qPPPPPPq....",
  ".....qqqqqq.....",
  "....DDDDDDDD....",
  "....DDDDDDDD....",
]);

/** A longcase clock, 14 × 68. The pendulum swings (PENDULUM). */
export function clockArt(): Art {
  const R: Rect[] = [];
  R.push([6, 0, 2, 2, "brass-hi"]);
  R.push([4, 2, 6, 1, "wood-deep"], [2, 3, 10, 1, "wood-deep"], [1, 4, 12, 18, "wood-deep"]);
  R.push([2, 4, 10, 17, "wood"], [3, 3, 8, 1, "wood-hi"], [2, 4, 1, 17, "wood-hi"]);
  // Face.
  R.push(...grid(["..nBBn..", ".nyyyyn.", "nyyKyyyn", "nyyKyyyn", "nyyKKKyn", "nyyyyyyn", ".nyyyyn.", "..nnnn.."], 3, 7));
  R.push([2, 19, 10, 1, "wood-lo"], [1, 21, 12, 1, "wood-deep"]);
  // Trunk with a glass door.
  R.push([3, 22, 8, 26, "wood-deep"], [4, 22, 6, 26, "wood"], [4, 22, 1, 26, "wood-hi"]);
  R.push([5, 24, 4, 21, "clock-glass"]);
  // Base.
  R.push([1, 48, 12, 1, "wood-deep"], [2, 49, 10, 15, "wood"], [1, 49, 1, 15, "wood-deep"], [12, 49, 1, 15, "wood-deep"]);
  R.push([2, 49, 10, 1, "wood-hi"], [4, 52, 6, 8, "wood-lo"], [5, 53, 4, 6, "wood"]);
  R.push([0, 64, 14, 1, "wood-deep"], [0, 65, 14, 2, "wood"], [0, 67, 14, 1, "wood-deep"]);
  return { w: 14, h: 68, rects: R };
}
/** Pendulum frames: left, middle, right, inside the clock's glass door. */
export const PENDULUM = [
  grid(["n...", "n...", ".n..", ".n..", ".n..", ".n..", ".n..", "..n.", "..n.", "..n.", "..n.", ".nn.", "nbBn", "nBBn", ".nn."], 4, 25),
  grid([".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".n..", ".nn.", "nbBn", "nBBn", ".nn."], 4, 25),
  grid(["..n.", "..n.", ".n..", ".n..", ".n..", ".n..", ".n..", "n...", "n...", "n...", "n...", "nn..", "bBn.", "BBn.", "nn.."], 4, 25),
];

/** A writing desk with a green banker's lamp, 34 × 36. */
export function deskArt(): Art {
  const R: Rect[] = [];
  // Lamp, ink and books on top.
  R.push(...grid(["..EEEEE..", ".EEEEEEE.", "EEEEEEEEE", "....n....", "....n....", "...nBn...", "..nBBBn.."], 2, 3));
  R.push(...grid(["33333333", "44444444", "yyyyyyYy", "KKKKKKKK"], 13, 6));
  R.push(...grid(["....y", "...y.", "..y..", ".KK..", "KKKK."], 25, 5));
  // Top.
  R.push([0, 10, 34, 1, "wood-hi"], [0, 11, 34, 1, "wood"], [0, 12, 34, 1, "wood-lo"]);
  // Pedestal of drawers on the left, a leg on the right.
  R.push([1, 13, 12, 23, "wood"], [1, 13, 1, 23, "wood-deep"], [12, 13, 1, 23, "wood-deep"]);
  for (const y of [14, 21, 28]) {
    R.push([2, y, 10, 6, "wood"], [2, y, 10, 1, "wood-hi"], [2, y + 5, 10, 1, "wood-lo"]);
    R.push([6, y + 2, 2, 1, "brass"]);
  }
  R.push([13, 13, 18, 4, "wood-lo"], [13, 17, 18, 1, "wood-deep"]);
  R.push([30, 13, 3, 23, "wood"], [32, 13, 1, 23, "wood-deep"], [30, 13, 1, 23, "wood-hi"]);
  return { w: 34, h: 36, rects: R };
}

/** A globe on a stand, 12 × 24. */
export const GLOBE = art([
  "....nnnn....",
  "..nn~~GG~n..",
  ".n~a~GGGG~n.",
  ".n~GG~~GG-n.",
  "n~~GGG~~~--n",
  "n~~~GG~~G--n",
  "n~~~~~~GGG-n",
  ".n~G~~~~G-n.",
  ".n~GG~~~--n.",
  "..nn~~~-nn..",
  "....nnnn....",
  ".....Bn.....",
  ".....Bn.....",
  "....nBBn....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  ".....Wd.....",
  "....wWWd....",
  "...wW..Wd...",
  "..wW....Wd..",
  ".wW......Wd.",
  "DD........DD",
  "............",
]);

/** A gramophone on a cabinet, 24 × 40. */
export function gramophoneArt(): Art {
  const R: Rect[] = grid([
    "...........bbbbb",
    ".........bbBBBBBn",
    "........bBBnnnBBn",
    ".......bBnKKKKnBn",
    ".......bBnKKKKnBn",
    "......bBBnKKKnBn.",
    "......bBBBnnnBBn.",
    ".....bBBBBBBBnn..",
    ".....bBBBBBnn....",
    "....bBBBBnn......",
    "....bBBnn........",
    "...bBnn..........",
    "...bBn...........",
    "...Bn............",
    "...Bn............",
    "..nBn............",
  ], 6, 0);
  R.push([4, 16, 16, 1, "brass"], [4, 17, 16, 3, "wood-deep"], [5, 17, 14, 1, "wood-lo"], [16, 15, 3, 1, "brass-lo"]);
  // Cabinet.
  R.push([2, 20, 20, 1, "wood-hi"], [2, 21, 20, 15, "wood"], [2, 20, 1, 16, "wood-deep"], [21, 20, 1, 16, "wood-deep"]);
  R.push([4, 23, 7, 10, "wood-lo"], [13, 23, 7, 10, "wood-lo"], [5, 24, 5, 8, "wood"], [14, 24, 5, 8, "wood"]);
  R.push([10, 27, 1, 2, "brass"], [13, 27, 1, 2, "brass"], [2, 36, 20, 1, "wood-deep"]);
  R.push([3, 37, 2, 3, "wood-deep"], [19, 37, 2, 3, "wood-deep"]);
  return { w: 24, h: 40, rects: R };
}

/** A lamp hanging from the ceiling on a chain, 11 × 17. */
export const PENDANT = art([
  ".....n.....",
  ".....B.....",
  ".....n.....",
  ".....B.....",
  ".....n.....",
  ".....B.....",
  ".....n.....",
  ".....B.....",
  "....mmm....",
  "...mlllm...",
  "..mlLLLLm..",
  ".mlLLLLLLm.",
  "mlLLLLLLLLm",
  "mmmmmmmmmmm",
  "....yFy....",
  ".....F.....",
  "...........",
]);

/** A wheeled library ladder leaning on a bookcase: `h` tall, foot `lean`
 *  dots further right than the top. */
export function ladderArt(h: number, lean: number): Art {
  const R: Rect[] = [];
  const w = lean + 8;
  for (let y = 0; y < h; y++) {
    const x = Math.round((y / (h - 1)) * lean);
    R.push([x, y, 1, 1, "wood-deep"], [x + 1, y, 1, 1, "wood"]);
    R.push([x + 6, y, 1, 1, "wood"], [x + 7, y, 1, 1, "wood-deep"]);
    if (y > 4 && y < h - 3 && y % 9 === 4) R.push([x + 2, y, 4, 1, "wood-hi"], [x + 2, y + 1, 4, 1, "wood-lo"]);
  }
  // Hooks over the crown, wheels on the floor.
  R.push([0, 0, 8, 1, "brass"], [lean, h - 2, 2, 2, "ink"], [lean + 6, h - 2, 2, 2, "ink"]);
  return { w, h, rects: R };
}

// ── On the shelves ───────────────────────────────────────────────────────

export const ORNAMENT_ART = {
  plant: art([".g.g..", "gGgGg.", "GjGGjg", ".GjGG.", "..jj..", "pPPPPq", ".PPPq.", ".qqqq."]),
  candle: art([".F.", ".f.", ".y.", ".y.", ".y.", ".Y.", "bBn", "nnn"]),
  vase: art(["i.i..", ".Gi..", "..G..", ".aAv.", "aAAAv", "aAAAv", ".AAv.", ".vvv."]),
  frame: art(["nBBBBBn", "BaaaaaB", "BaaaaaB", "BGGaGGB", "BGGGGGB", "nBBBBBn", ".n...n."]),
  globe: art([".nnnn..", "n~GG~n.", "n~~GG-n", "nG~~--n", ".n~-nn.", "..nn...", "..Bn...", ".nBBn.."]),
  hourglass: art(["nBBBn", ".yyy.", "..y..", "..a..", ".aya.", ".yyy.", "nBBBn"]),
  teapot: art(["...nB...", ".yyyyy..", "yyyyyyyy", "y.yyyyY.", ".YYYYY.."]),
} as const;

export const BOOKEND = art(["Bn.", "Bn.", "Bn.", "Bn.", "Bn.", "Bn.", "Bn.", "Bn.", "Bn.", "bBn"]);

// ── The house ────────────────────────────────────────────────────────────

/** A shrub for the garden, 14 × 9. */
export const SHRUB = art([
  "....gGGg......",
  "..gGGGGGGg.g..",
  ".gGGjGGGGGgGg.",
  "gGGGGGjGGGGGGg",
  "GGjGGGGGGjGGGG",
  "GGGGjGGGiGGjGG",
  "jGGGGGGGGGGGjj",
  ".jjGGjjGGjjjj.",
  "..jjjjjjjjjj..",
]);

/** Where the house stands in the scene, in dots. */
export interface HouseGeometry {
  sceneW: number;
  houseX: number;
  houseW: number;
  roofTop: number;
  roofH: number;
  floorsTop: number;
  floorCount: number;
  storey: number;
  roomH: number;
  beam: number;
  wall: number;
  foundation: number;
  ground: number;
  /** Left edge of the chimney stack. */
  chimneyX: number;
}

/** Overhang of the roof past the walls. */
const EAVES = 4;

/** The top of the roof's slope at scene column `x`: 2 across for 1 up. */
export function roofSurface(g: HouseGeometry, x: number): number {
  const left = g.houseX - EAVES;
  const right = g.houseX + g.houseW + EAVES;
  const fromEdge = Math.min(x - left, right - 1 - x);
  return g.roofTop + Math.max(0, g.roofH - 1 - Math.floor(fromEdge / 2));
}

/** A run of bricks: mortar every third row, joints staggered. */
function bricks(R: Rect[], x: number, y: number, w: number, h: number) {
  R.push([x, y, w, h, "brick"]);
  for (let row = 0; row * 3 < h; row++) {
    const ry = y + row * 3 + 2;
    if (ry < y + h) R.push([x, ry, w, 1, "brick-lo"]);
    for (let bx = x + (row % 2 ? 1 : 4); bx < x + w; bx += 6) {
      R.push([bx, y + row * 3, 1, Math.min(2, y + h - (y + row * 3)), "brick-lo"]);
    }
  }
}

/**
 * The house itself: chimney, roof, storeys with papered walls and panelled
 * wainscot, the floors between them, the outside walls, the foundations and
 * a strip of garden. Bookcases and furniture are drawn over it.
 */
export function houseArt(g: HouseGeometry): Rect[] {
  const R: Rect[] = [];
  const { houseX: hx, houseW: hw, wall } = g;
  const inner = hw - 2 * wall;

  // Chimney, behind the roof, standing above it by its cap.
  const cw = 10;
  // The stack, cap and pot stand 16 dots over the roof.
  const cTop = roofSurface(g, g.chimneyX + cw) - 11;
  bricks(R, g.chimneyX, cTop, cw, g.floorsTop - cTop);
  R.push([g.chimneyX - 1, cTop - 2, cw + 2, 1, "stone-hi"], [g.chimneyX - 1, cTop - 1, cw + 2, 1, "stone-lo"]);
  R.push([g.chimneyX + 3, cTop - 5, 4, 3, "pot"], [g.chimneyX + 3, cTop - 5, 1, 3, "pot-hi"], [g.chimneyX + 2, cTop - 5, 6, 1, "pot-lo"]);

  // Roof: courses of shingles, three rows each, with darker verges.
  const left = hx - EAVES;
  const right = hx + hw + EAVES;
  for (let r = 0; r < g.roofH; r++) {
    const inset = (g.roofH - 1 - r) * 2;
    const x0 = left + inset;
    const x1 = right - inset;
    const y = g.roofTop + r;
    const course = Math.floor(r / 3);
    const row = r % 3;
    R.push([x0, y, x1 - x0, 1, row === 0 ? "roof-hi" : row === 2 ? "roof-lo" : "roof"]);
    if (row === 1) {
      const offset = course % 2 ? 3 : 0;
      for (let x = x0 + ((((offset - x0) % 6) + 6) % 6); x < x1; x += 6) R.push([x, y, 1, 1, "roof-lo"]);
    }
    R.push([x0, y, 2, 1, "roof-deep"], [x1 - 2, y, 2, 1, "roof-deep"]);
  }
  const ridge = left + (g.roofH - 1) * 2;
  R.push([ridge, g.roofTop, right - (g.roofH - 1) * 2 - ridge, 1, "roof-deep"]);
  R.push([left, g.floorsTop - 1, right - left, 1, "roof-deep"]);

  // A round attic window in a tall enough roof.
  if (g.roofH >= 20) {
    const ax = hx + Math.floor(hw / 2) - 6;
    const ay = g.roofTop + g.roofH - 17;
    R.push(...grid([
      "....DDDD....",
      "..DDwwwwDD..",
      ".DwwAAAAwwD.",
      ".DwAAAWAAwD.",
      "DwAAAAWAAAwD",
      "DwWWWWWWWWwD",
      "DwAAAAWAAAwD",
      ".DwAAAWAAwD.",
      ".DwwAAAAwwD.",
      "..DDwwwwDD..",
      "....DDDD....",
    ], ax, ay).map((r): Rect => (r[4] === "glass" ? [r[0], r[1], r[2], r[3], "attic"] : r)));
  }

  for (let f = 0; f < g.floorCount; f++) {
    const beam = g.floorsTop + f * g.storey;
    const top = beam + g.beam;
    const floorLine = top + g.roomH;
    // The beam over this storey: under the roof it is the wall plate, else
    // it is the floor of the storey above.
    if (f === 0) {
      R.push([hx, beam, hw, g.beam, "wood-deep"], [hx, beam + 1, hw, 2, "wood-lo"]);
    } else {
      floorboards(R, hx, beam, hw, g.beam);
    }
    // Papered wall with a stripe, a cornice, and panelled wainscot.
    R.push([hx + wall, top, inner, g.roomH, "wall"]);
    for (let x = hx + wall + 5; x < hx + wall + inner; x += 10) {
      R.push([x, top + 3, 1, g.roomH - 31, "wall-2"], [x + 2, top + 3, 1, g.roomH - 31, "wall-2"]);
    }
    for (let x = hx + wall + 10; x < hx + wall + inner; x += 10) {
      for (let y = top + 8; y < floorLine - 34; y += 12) R.push([x, y, 1, 1, "wall-2"]);
    }
    R.push([hx + wall, top, inner, 1, "wood-lo"], [hx + wall, top + 1, inner, 2, "wall-shadow"]);
    const rail = floorLine - 28;
    R.push([hx + wall, rail, inner, 25, "wainscot"]);
    R.push([hx + wall, rail, inner, 1, "wood-hi"], [hx + wall, rail + 1, inner, 1, "wood"], [hx + wall, rail + 2, inner, 1, "wood-lo"]);
    for (let x = hx + wall + 4; x + 16 <= hx + wall + inner - 2; x += 20) {
      R.push([x, rail + 6, 16, 1, "wainscot-lo"], [x, rail + 6, 1, 15, "wainscot-lo"]);
      R.push([x + 1, rail + 20, 15, 1, "wainscot-hi"], [x + 15, rail + 7, 1, 13, "wainscot-hi"]);
    }
    R.push([hx + wall, floorLine - 3, inner, 2, "wood"], [hx + wall, floorLine - 3, inner, 1, "wood-hi"], [hx + wall, floorLine - 1, inner, 1, "wood-deep"]);
    // Outside walls.
    bricks(R, hx, top, wall, g.roomH);
    bricks(R, hx + hw - wall, top, wall, g.roomH);
    R.push([hx, top, 1, g.roomH, "brick-lo"], [hx + hw - 1, top, 1, g.roomH, "brick-lo"]);
  }

  // Ground floor's floor, foundations and the garden.
  const bottom = g.floorsTop + g.floorCount * g.storey;
  floorboards(R, hx, bottom, hw, g.beam);
  const base = bottom + g.beam;
  R.push([hx - 2, base, hw + 4, g.foundation, "stone"]);
  R.push([hx - 2, base, hw + 4, 1, "stone-hi"], [hx - 2, base + g.foundation - 1, hw + 4, 1, "stone-lo"]);
  for (let x = hx + 4; x < hx + hw; x += 9) R.push([x, base + 1, 1, g.foundation - 2, "stone-lo"]);
  const earth = base + g.foundation;
  R.push([0, earth, g.sceneW, 1, "grass-hi"], [0, earth + 1, g.sceneW, 1, "grass"], [0, earth + 2, g.sceneW, g.ground - 2, "soil"]);
  for (let x = 1; x < g.sceneW; x += 5) R.push([x, earth - 1, 1, 1, "grass"], [x + 2, earth + 3, 1, 1, "soil-lo"]);
  return R;
}

/** The boards of a floor seen from the front, over a joist. */
function floorboards(R: Rect[], x: number, y: number, w: number, h: number) {
  R.push([x, y, w, 1, "floor-hi"], [x, y + 1, w, h - 3, "floor"], [x, y + h - 2, w, 2, "wood-deep"]);
  for (let bx = x + 7; bx < x + w; bx += 14) R.push([bx, y + 1, 1, h - 3, "floor-lo"]);
}
