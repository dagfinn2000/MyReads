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
  // For the house styles (room-shells.ts) and the tapestries.
  N: "curtain-hi",
  R: "curtain",
  Z: "curtain-lo",
  "5": "rug",
  "6": "rug-2",
  "7": "rug-3",
  "8": "rug-fringe",
  I: "light",
  J: "trim",
  M: "metal",
  "+": "metal-hi",
  "=": "metal-lo",
  Q: "outer",
  "&": "outer-hi",
  "#": "outer-lo",
  "9": "copper",
  "!": "copper-hi",
  "?": "copper-lo",
  "*": "cap",
  "<": "bark",
  ">": "bark-lo",
  "{": "pine",
  "}": "pine-lo",
};

/** A text grid as rectangles: each run of one character on a row becomes
 *  one rectangle. `ox`/`oy` shift it; `key` adds or overrides characters. */
export function grid(rows: readonly string[], ox = 0, oy = 0, key?: Record<string, Paint>): Rect[] {
  const out: Rect[] = [];
  rows.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const ch = line[x];
      let end = x + 1;
      while (end < line.length && line[end] === ch) end++;
      const paint = key?.[ch] ?? KEY[ch];
      if (paint) out.push([ox + x, oy + y, end - x, 1, paint]);
      x = end;
    }
  });
  return out;
}

export function art(rows: readonly string[]): Art {
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

/** A sprite standing on the floor, `x` from the scene's left. */
export function Stand({ art: a, x, floorLine, scale: s, className, children }: {
  art: Art;
  x: number;
  floorLine: number;
  scale: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Sprite
      art={a}
      scale={s}
      className={`room-abs ${className ?? ""}`}
      style={{ left: x * s, top: (floorLine - a.h) * s }}
    >
      {children}
    </Sprite>
  );
}

/** A warm pool of light, shown at night (dark themes) only. */
export function Glow({ x, y, r, scale: s, className }: { x: number; y: number; r: number; scale: number; className?: string }) {
  return (
    <div
      className={`room-glow ${className ?? ""}`}
      aria-hidden="true"
      style={{ left: (x - r) * s, top: (y - r) * s, width: 2 * r * s, height: 2 * r * s }}
    />
  );
}

/** A lamp hanging from the ceiling, with its glow. */
export function Pendant({ x, ceiling, scale: s }: { x: number; ceiling: number; scale: number }) {
  return (
    <>
      <Sprite art={PENDANT} scale={s} className="room-abs" style={{ left: x * s, top: ceiling * s }} />
      <Glow x={x + 5.5} y={ceiling + 15} r={26} scale={s} />
    </>
  );
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

/** What hangs over the fireplace (Decorate › Over the fireplace) that isn't
 *  the painting: a tapestry, 32 × 44, woven in the room's fabric colours on
 *  a rod with brass finials, with a fringe at the foot. */
export function tapestryArt(design: "tree" | "stag" | "stars" | "waves" | "kilim"): Art {
  const R: Rect[] = [];
  // The cloth, a gold border inside a dark edge, and the fringe.
  R.push([2, 2, 28, 38, "chair-deep"], [3, 3, 26, 36, "rug-2"], [4, 4, 24, 34, "chair"]);
  for (let x = 3; x < 29; x += 2) R.push([x, 40, 1, 3, "rug-fringe"]);
  // Rod and finials, tabs over it.
  R.push([1, 1, 30, 1, "wood"], [1, 2, 30, 1, "wood-lo"], [0, 0, 2, 3, "brass"], [30, 0, 2, 3, "brass"]);
  for (let x = 5; x < 28; x += 5) R.push([x, 0, 2, 2, "chair-lo"]);
  const dot = (x: number, y: number, paint: string) => R.push([x, y, 1, 1, paint]);
  const diamond = (cx: number, cy: number, r: number, paint: string) => {
    for (let dy = -r; dy <= r; dy++) {
      const w = r - Math.abs(dy);
      R.push([cx - w, cy + dy, 2 * w + 1, 1, paint]);
    }
  };
  switch (design) {
    case "tree": {
      // A tree of life: a trunk, branches each ending in a leaf, golden
      // fruit, two birds, and roots spreading at the foot.
      R.push([15, 17, 2, 18, "chair-deep"]);
      R.push([11, 35, 10, 1, "chair-deep"], [9, 36, 3, 1, "chair-deep"], [20, 36, 3, 1, "chair-deep"]);
      for (const [y0, len] of [[30, 7], [25, 8], [20, 8], [15, 6]] as const) {
        for (let k = 1; k <= len; k++) {
          dot(15 - k, y0 - (k >> 1), "chair-deep");
          dot(16 + k, y0 - (k >> 1), "chair-deep");
        }
        for (const lx of [15 - len, 16 + len]) {
          diamond(lx, y0 - (len >> 1) - 1, 2, "leaf");
          dot(lx, y0 - (len >> 1) - 1, "leaf-hi");
        }
        dot(12, y0 - 3, "rug-2");
        dot(19, y0 - 3, "rug-2");
      }
      diamond(15, 10, 4, "leaf");
      diamond(16, 10, 4, "leaf");
      R.push([15, 8, 2, 4, "leaf-hi"]);
      R.push(...grid(["6.6", ".66", "..6"], 6, 6), ...grid(["6.6", "66.", "6.."], 23, 6));
      return { w: 32, h: 44, rects: R };
    }
    case "stag":
      // A stag among trees under the stars.
      R.push(
        ...grid(
          [
            "..y..y......y..y",
            ".yy.yy.....yy.yy",
            "..yyy.......yyy.",
            "...yy.y...y.yy..",
            "....yyy...yyy...",
            "......yy.yy.....",
            ".......yyy......",
            "......yyyy......",
            ".....yyyyy......",
            ".....yyyy.......",
            "......yyy.......",
            "......yyyyyyyyy.",
            "......yyyyyyyyyy",
            ".......yyyyyyyyy",
            ".......yy....yy.",
            ".......y.y...y.y",
            ".......y.y...y.y",
            ".......y.y...y.y",
          ],
          6,
          13,
        ),
      );
      for (const tx of [6, 25]) {
        for (let k = 0; k < 4; k++) R.push([tx - k, 22 + k * 3, 2 * k + 1, 3, "leaf"]);
        R.push([tx, 34, 1, 3, "chair-deep"]);
      }
      R.push([4, 37, 24, 1, "leaf-lo"]);
      for (const [x, y] of [[8, 7], [14, 5], [21, 8], [26, 6], [11, 10], [24, 11]] as const) dot(x, y, "rug-2");
      return { w: 32, h: 44, rects: R };
    case "stars":
      // The sun and the moon, with stars between and the sea beneath.
      diamond(10, 11, 4, "rug-2");
      R.push([7, 9, 7, 5, "rug-2"]);
      for (const [x, y] of [[10, 5], [10, 17], [4, 11], [16, 11], [6, 7], [14, 7], [6, 15], [14, 15]] as const) dot(x, y, "rug-2");
      R.push(...grid([".yyy", "yy..", "y...", "y...", "yy..", ".yyy"], 20, 8));
      for (const [x, y] of [[7, 22], [16, 20], [24, 18], [12, 26], [21, 25], [26, 23], [5, 28], [17, 29]] as const) {
        R.push([x - 1, y, 3, 1, "paper"], [x, y - 1, 1, 3, "paper"]);
      }
      for (let x = 4; x < 28; x++) {
        const y = 33 + Math.round(Math.sin(x / 1.6));
        R.push([x, y, 1, 1, "cushion"], [x, y + 1, 1, 37 - y, "chair-lo"]);
      }
      return { w: 32, h: 44, rects: R };
    case "waves": {
      // Rows of breaking waves, crests picked out in foam.
      const cell = ["..yyyy..", ".y....y.", "y..UU..y", "..U..U..", ".U....U.", "U......U"];
      for (let row = 0; row < 6; row++) {
        const off = row % 2 ? 4 : 0;
        for (let col = -1; col < 4; col++) {
          grid(cell, 4 + col * 8 + off, 5 + row * 6).forEach((r) => {
            const x0 = Math.max(r[0], 4);
            const x1 = Math.min(r[0] + r[2], 28);
            if (x1 > x0) R.push([x0, r[1], x1 - x0, r[3], r[4]]);
          });
        }
      }
      return { w: 32, h: 44, rects: R };
    }
    case "kilim":
      // Diamonds within diamonds down the middle, zigzags at the ends.
      for (const cy of [12, 21, 30]) {
        diamond(16, cy, 5, "rug-2");
        diamond(16, cy, 3, "chair-deep");
        diamond(16, cy, 1, "paper");
      }
      for (let x = 4; x < 28; x++) {
        const z = Math.abs(((x - 4) % 4) - 2);
        R.push([x, 5 + z, 1, 1, "rug-2"], [x, 36 - z, 1, 1, "rug-2"]);
      }
      for (const [x, y] of [[7, 16], [25, 16], [7, 26], [25, 26]] as const) {
        R.push([x - 1, y, 3, 1, "paper"], [x, y - 1, 1, 3, "paper"]);
      }
      return { w: 32, h: 44, rects: R };
  }
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

/** Where a cat's coat (lib/pets.ts) puts a tabby's stripes, a calico's
 *  two colours of patch and a Siamese's dark ears and tail; plainer coats
 *  paint them over in their own colours. */
export const CAT_MARKS: Record<string, Paint> = { s: "cat-stripe", a: "cat-patch", b: "cat-patch2", n: "cat-point" };

/** The cat, asleep in a curl, 13 × 7. Its tail tip flicks (CAT_TAIL). */
export const CAT: Art = {
  w: 13,
  h: 7,
  rects: grid(
    [
      ".H.H.........",
      "HnHnH..HHHH..",
      "HOOOHHHOsOsH.",
      "HOHOObbOOsOOH",
      "HuOOObbaaOhOH",
      ".HuuOhhaahhOH",
      "..HHHHHHHHHH.",
    ],
    0,
    0,
    CAT_MARKS,
  ),
};
export const CAT_TAIL = grid(["..HH", ".HnH", "HnH.", "HH.."], 11, 1, CAT_MARKS);

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

// ── The house (drawn in room-shells.ts) ──────────────────────────────────

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
