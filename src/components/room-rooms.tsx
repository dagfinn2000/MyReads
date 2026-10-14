/**
 * The furniture of the rooms the reader can add to the house (lib/room.ts:
 * ROOMS): a kitchen, a bedroom, a music room, a conservatory, a games room,
 * a studio, a bathroom, a dining room, a nursery, a woodshop and a sauna.
 * Drawn like the rest of the room (room-art.tsx), each piece stands on the
 * floor with its left edge at `x`, and some bring something for the wall
 * or the ceiling above them: tiles and pans over the range, a window
 * behind the conservatory's chair, a lamp over the billiard table, a
 * looking glass over the washstand, a chandelier over the dining table, a
 * mobile over the cot, a rack of tools over the workbench, and the sauna
 * stove's flue.
 */
import {
  CANDLESTICK,
  Glow,
  Pendant,
  Rects,
  STEAM,
  Sprite,
  Stand,
  grid,
  type Art,
  type Paint,
  type Rect,
} from "@/components/room-art";
import type { RoomPiece } from "@/lib/room";

/** Paints the rooms add to room-art's text-grid key. */
const KEY: Record<string, Paint> = {
  "0": "felt",
  "(": "felt-hi",
  ")": "felt-lo",
  "[": "marble-hi",
  "]": "marble",
  "|": "marble-lo",
  "/": "wicker-hi",
  ":": "wicker",
  ";": "wicker-lo",
  ",": "bird",
  "'": "bird-lo",
  _: "tile",
  "`": "tile-lo",
};
const g = (rows: readonly string[], ox = 0, oy = 0) => grid(rows, ox, oy, KEY);
/** A text grid with some characters standing for other paints. */
const gk = (key: Record<string, Paint>, rows: readonly string[], ox = 0, oy = 0) =>
  grid(rows, ox, oy, { ...KEY, ...key });

/** A filled circle of dots. */
function disc(R: Rect[], cx: number, cy: number, r: number, paint: Paint) {
  for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    const x0 = Math.ceil(cx - half - 0.001);
    const x1 = Math.floor(cx + half + 0.001);
    if (x1 >= x0) R.push([x0, y, x1 - x0 + 1, 1, paint]);
  }
}

/** A steady little hash, for scattering knots and stones without a
 *  pattern that repeats. */
const scatter = (a: number, b: number) => {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** A line of dots from one point to another, `thick` dots across. */
function line(R: Rect[], x0: number, y0: number, x1: number, y1: number, paint: Paint, thick = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    R.push([x, y, thick, 1, paint]);
  }
}

// ── Kitchen ──────────────────────────────────────────────────────────────

/** A cast-iron range, 34 wide, with a tiled splashback and a rail of pans
 *  over it; a pot and the kettle on the hob. 34 × 74. */
function rangeArt(): Art {
  const R: Rect[] = [];
  // Glazed tiles, staggered, a blue one here and there.
  R.push([2, 14, 30, 32, "tile"]);
  for (let row = 0, y = 14; y < 46; row++, y += 5) {
    R.push([2, y, 30, 1, "tile-lo"]);
    for (let x = 2 + (row % 2 ? 3 : 0); x < 32; x += 6) {
      R.push([x, y + 1, 1, 4, "tile-lo"]);
      if ((x * 7 + row * 3) % 5 === 0) R.push([x + 2, y + 2, 2, 2, "sea"]);
    }
  }
  // The rail and what hangs on it: a ladle, a copper pan, a spoon.
  R.push([3, 17, 28, 1, "brass"], [3, 18, 28, 1, "brass-lo"], [2, 16, 2, 3, "brass-lo"], [30, 16, 2, 3, "brass-lo"]);
  R.push([7, 19, 1, 8, "metal"], ...g(["+M=", ".=."], 6, 27));
  R.push([15, 19, 1, 6, "copper-lo"]);
  R.push(...g(["..!!!!!..", ".!99999?.", "!9999999?", "!9!99999?", "!9999999?", ".?99999?.", "..?????.."], 11, 25));
  R.push([25, 19, 1, 8, "wood"], ...g([".w.", "wWd", "wWd", ".d."], 24, 27));
  // On the hob: a pot, and the kettle.
  R.push(...g(["..======..", ".+MMMMMM=.", "=+MMMMMM==", ".+MMMMMM=.", ".+MMMMMM=."], 3, 41));
  R.push(
    ...g(
      [
        "...nBBn...",
        "..n....n..",
        "..n.nn.n..",
        "...!99?...",
        "..!9999?.9",
        ".!999999?9",
        ".!9999999?",
        ".!999999?.",
        "..??????..",
      ],
      20,
      37,
    ),
  );
  // The range: the hob, the towel rail, an oven door, the fire door with a
  // window, and an ash door.
  R.push([0, 46, 34, 1, "metal-hi"], [0, 47, 34, 2, "metal"], [0, 49, 34, 1, "metal-lo"]);
  R.push([1, 50, 32, 22, "metal-lo"], [1, 50, 1, 22, "metal"], [32, 50, 1, 22, "soot"]);
  R.push([0, 52, 34, 1, "brass"], [0, 53, 34, 1, "brass-lo"], [1, 51, 1, 2, "brass-lo"], [32, 51, 1, 2, "brass-lo"]);
  R.push([3, 55, 13, 15, "soot"], [4, 56, 11, 13, "metal-lo"], [5, 59, 9, 9, "metal"], [6, 60, 7, 7, "metal-lo"]);
  R.push([6, 57, 7, 1, "brass"]);
  R.push([18, 55, 13, 8, "soot"], [19, 56, 11, 6, "metal-lo"], [21, 57, 7, 4, "ember"]);
  R.push([18, 64, 13, 6, "soot"], [19, 65, 11, 4, "metal-lo"], [21, 66, 7, 1, "soot"], [21, 68, 7, 1, "soot"]);
  R.push([0, 72, 34, 2, "soot"], [1, 72, 4, 2, "metal"], [29, 72, 4, 2, "metal"]);
  return { w: 34, h: 74, rects: R };
}
const RANGE = rangeArt();
/** The fire behind the range's little window, in two flickers. */
const RANGE_FLAMES = [g(["..f..r.", ".rFf.fr", "rfFFfFf"], 21, 58), g([".r..f..", "rf.rFf.", "fFfFFfr"], 21, 58)];

/** A dresser of plates and jugs over a cupboard, 36 × 80. */
function dresserArt(): Art {
  const R: Rect[] = [];
  const plate = (x: number, y: number) =>
    R.push(...g(["..YyyY..", ".Yy~~yY.", "Yy~yy~yY", "Y~yyyy~Y", "Yy~yy~yY", ".Yy~~yY.", "..YYYY.."], x, y));
  const jug = (x: number, y: number) =>
    R.push(...g(["..yyyy.", ".yYYYyy", "yy~~~yY", "y~yyy~Y", "yy~~~yY", ".yyyyY.", ".YYYYY."], x, y));
  // Crown.
  R.push([0, 0, 36, 1, "wood-deep"], [1, 1, 34, 2, "wood"], [1, 1, 34, 1, "wood-hi"], [0, 3, 36, 1, "wood-deep"]);
  // Open shelves on a dark back.
  R.push([3, 4, 30, 44, "case-back"]);
  R.push([1, 4, 2, 44, "wood"], [33, 4, 2, 44, "wood"], [1, 4, 1, 44, "wood-hi"], [34, 4, 1, 44, "wood-deep"]);
  for (const y of [16, 30, 44]) R.push([3, y, 30, 1, "wood-hi"], [3, y + 1, 30, 1, "wood-lo"]);
  // Plates on the top shelf, jugs and cups below, bowls at the bottom.
  for (const x of [4, 14, 24]) plate(x, 9);
  jug(5, 23);
  plate(14, 23);
  jug(25, 23);
  for (const x of [5, 13, 21, 27]) R.push([x, 32, 1, 1, "brass-lo"], ...g(["yyy", "yyY", ".Y."], x - 1, 33));
  R.push(
    ...g(
      ["............~~~~~~~~~~", "...yyyyyy..yyyyyyyyyyY", "..y~~~~~~Y..YyyyyyyyY.", "...YYYYYY....YYYYYYYY."],
      4,
      40,
    ),
  );
  // Worktop and the cupboard: three drawers, two doors.
  R.push([0, 48, 36, 1, "wood-hi"], [0, 49, 36, 2, "wood"], [0, 51, 36, 1, "wood-deep"]);
  R.push([1, 52, 34, 26, "wood"], [1, 52, 1, 26, "wood-hi"], [34, 52, 1, 26, "wood-deep"]);
  for (const x of [3, 13, 23]) R.push([x, 54, 10, 5, "wood-lo"], [x + 1, 55, 8, 3, "wood"], [x + 4, 56, 2, 1, "brass"]);
  for (const x of [3, 19]) {
    R.push(
      [x, 61, 14, 15, "wood-lo"],
      [x + 1, 62, 12, 13, "wood"],
      [x + 2, 63, 10, 11, "wood-lo"],
      [x + 3, 64, 8, 9, "wood"],
    );
  }
  R.push([15, 68, 1, 2, "brass"], [20, 68, 1, 2, "brass"]);
  R.push([0, 78, 36, 2, "wood-deep"]);
  return { w: 36, h: 80, rects: R };
}

/** A ladder-backed chair seen from the side, facing right (or left), with
 *  a cushion, 8 × 32. */
function sideChair(R: Rect[], x: number, facing: 1 | -1, top = 0, seat: Paint = "cushion") {
  const at = (dx: number, w = 1) => (facing === 1 ? x + dx : x + 7 - dx - w + 1);
  R.push([at(0, 2), top, 2, 32 - top, "wood"], [at(0), top, 1, 32 - top, facing === 1 ? "wood-hi" : "wood-lo"]);
  R.push([at(0, 2), top, 2, 1, "wood-hi"]);
  for (const y of [top + 4, top + 8, top + 12]) R.push([at(0, 2), y, 2, 1, "wood-lo"]);
  R.push([at(1, 6), 15, 6, 2, seat], [at(1, 6), 15, 6, 1, `${seat}-hi`]);
  R.push([at(0, 8), 17, 8, 1, "wood-hi"], [at(0, 8), 18, 8, 1, "wood"], [at(0, 8), 19, 8, 1, "wood-deep"]);
  R.push([at(6, 2), 20, 2, 12, "wood-lo"], [at(2, 4), 26, 4, 1, "wood-lo"]);
}

/** The kitchen table with a bowl of fruit and a loaf, a chair at each
 *  end, 46 × 32. */
function tableArt(): Art {
  const R: Rect[] = [];
  sideChair(R, 0, 1, 1);
  sideChair(R, 38, -1, 1);
  R.push(...g(["...j.....", "..iii.ff.", ".iiiiffff", "yyyyyyyyy", ".Yyy~yyY.", "..YYYYY.."], 16, 4));
  R.push(...g(["..ppp..", ".pPPPPq", "pPPPPPq", "wwwwwww"], 28, 6));
  R.push([8, 10, 30, 1, "wood-hi"], [8, 11, 30, 2, "wood"], [8, 13, 30, 1, "wood-deep"]);
  R.push([10, 14, 26, 3, "wood-lo"], [10, 14, 26, 1, "wood"]);
  R.push([10, 14, 2, 18, "wood"], [10, 14, 1, 18, "wood-hi"], [34, 14, 2, 18, "wood"], [35, 14, 1, 18, "wood-lo"]);
  R.push([12, 26, 22, 1, "wood-lo"]);
  return { w: 46, h: 32, rects: R };
}

// ── Bedroom ──────────────────────────────────────────────────────────────

/** A tall wardrobe with a looking-glass door and a hatbox on top, 30 × 91. */
function wardrobeArt(): Art {
  const R: Rect[] = [];
  R.push(
    ...g(
      [".NNNNNNNNNN.", "NRRRRRRRRRRZ", "bbbbbbbbbbbb", "NRRRRRRRRRRZ", "NRRRRRRRRRRZ", "NRRRRRRRRRRZ", ".ZZZZZZZZZZ."],
      4,
      0,
    ),
  );
  const top = 7;
  R.push(
    [0, top, 30, 1, "wood-deep"],
    [1, top + 1, 28, 3, "wood"],
    [1, top + 1, 28, 1, "wood-hi"],
    [0, top + 4, 30, 1, "wood-deep"],
  );
  R.push([1, top + 5, 28, 72, "wood"], [1, top + 5, 1, 72, "wood-hi"], [28, top + 5, 1, 72, "wood-deep"]);
  R.push([14, top + 6, 2, 70, "wood-deep"]);
  for (const x of [3, 16]) {
    R.push([x, top + 8, 11, 66, "wood-lo"], [x + 1, top + 9, 9, 64, "wood"]);
    R.push([x + 2, top + 44, 7, 28, "wood-lo"], [x + 3, top + 45, 5, 26, "wood"]);
  }
  // The looking glass, and the panel under it on the other door.
  R.push([5, top + 11, 7, 30, "wood-lo"], [6, top + 12, 5, 28, "wood"]);
  R.push([18, top + 11, 7, 30, "wood-deep"], [19, top + 12, 5, 28, "glass"], [19, top + 12, 5, 9, "glass-hi"]);
  R.push([20, top + 14, 1, 3, "glass-shine"], [21, top + 13, 1, 2, "glass-shine"], [22, top + 30, 1, 4, "glass-shine"]);
  R.push([12, top + 42, 1, 3, "brass"], [17, top + 42, 1, 3, "brass"]);
  R.push([0, top + 77, 30, 1, "wood-deep"], [1, top + 78, 28, 3, "wood"], [1, top + 78, 28, 1, "wood-hi"]);
  R.push([0, top + 81, 30, 1, "wood-deep"], [2, top + 82, 4, 2, "wood-deep"], [24, top + 82, 4, 2, "wood-deep"]);
  return { w: 30, h: top + 84, rects: R };
}

/** A bed side on, its head to the right, under a patchwork quilt in the
 *  room's fabrics, 50 × 40. */
function bedArt(): Art {
  const R: Rect[] = [];
  // Footboard on the left, headboard on the right.
  R.push(
    [0, 14, 5, 20, "wood"],
    [1, 12, 3, 2, "wood"],
    [1, 12, 3, 1, "wood-hi"],
    [0, 14, 1, 20, "wood-hi"],
    [4, 14, 1, 20, "wood-deep"],
  );
  R.push([1, 17, 3, 8, "wood-lo"]);
  R.push(
    [45, 2, 5, 32, "wood"],
    [46, 0, 3, 2, "wood"],
    [46, 0, 3, 1, "wood-hi"],
    [45, 2, 1, 32, "wood-hi"],
    [49, 2, 1, 32, "wood-deep"],
  );
  R.push([46, 6, 3, 10, "wood-lo"], [46, 18, 3, 6, "wood-lo"]);
  // The frame, mattress and pillows.
  R.push([5, 28, 40, 3, "wood-lo"], [5, 28, 40, 1, "wood"]);
  R.push([5, 21, 40, 7, "paper"], [5, 27, 40, 1, "paper-lo"]);
  R.push(...g([".yyyyyyyy.", "yyyyyyyyyY", "yyyyyyyyYY", ".YYYYYYYY."], 35, 16));
  R.push(...g(["..yyyyyy.", ".yyyyyyyY", "yyyyyyyYY", "YYYYYYYY."], 33, 18));
  // The quilt: turned down at the head, hanging over the side.
  R.push([31, 19, 3, 10, "paper"], [31, 19, 3, 1, "paper-lo"]);
  const patches: Paint[] = ["cushion", "curtain", "rug-2", "chair-hi", "cushion-lo", "rug"];
  for (let py = 0; py < 3; py++) {
    for (let px = 0; px < 7; px++) {
      R.push([5 + px * 4 - (px === 0 ? 0 : 0), 19 + py * 4, 4, 4, patches[(px * 2 + py * 3) % patches.length]]);
    }
  }
  R.push([5, 19, 26, 1, "cushion-hi"], [5, 30, 26, 1, "cushion-lo"]);
  for (let x = 6; x < 31; x += 2) R.push([x, 31, 1, 1, "cushion-lo"]);
  R.push([1, 34, 3, 6, "wood-deep"], [46, 34, 3, 6, "wood-deep"]);
  return { w: 50, h: 40, rects: R };
}
/** A sampler stitched with a heart, framed over the bed, 14 × 13. */
const SAMPLER: Art = {
  w: 14,
  h: 13,
  rects: [
    [0, 0, 14, 13, "wood-deep"],
    [1, 1, 12, 11, "wood"],
    [2, 2, 10, 9, "paper"],
    ...g(["..ii.ii..", ".iiiiiii.", ".iiiiiii.", "..iiiii..", "...iii...", "....i...."], 2, 3),
    [2, 10, 10, 1, "paper-lo"],
  ],
};

/** A bedside table with a lamp and an alarm clock, 14 × 40. */
function nightstandArt(): Art {
  const R: Rect[] = [];
  R.push(...g(["...mmmmmm...", "..mlllllllm.", "..mlLLLLLLm.", ".mlLLLLLLLLm", ".mmmmmmmmmmm"], 0, 3));
  R.push([5, 8, 1, 7, "brass"], [6, 8, 1, 7, "brass-lo"], ...g(["..bBn..", ".bBBBn."], 2, 15));
  R.push(...g([".nn.", "nyyn", "nyKn", ".nn."], 9, 13));
  R.push([0, 17, 14, 1, "wood-hi"], [0, 18, 14, 2, "wood"], [0, 20, 14, 1, "wood-deep"]);
  R.push([1, 21, 12, 15, "wood"], [1, 21, 1, 15, "wood-hi"], [12, 21, 1, 15, "wood-deep"]);
  R.push([2, 22, 10, 5, "wood-lo"], [3, 23, 8, 3, "wood"], [6, 24, 2, 1, "brass"]);
  R.push([2, 29, 10, 6, "wood-lo"], [3, 30, 8, 4, "wood"], [6, 31, 2, 1, "brass"]);
  R.push([1, 36, 2, 4, "wood-deep"], [11, 36, 2, 4, "wood-deep"]);
  return { w: 14, h: 40, rects: R };
}

// ── Music room ───────────────────────────────────────────────────────────

/** An upright piano with music on its stand, 44 × 50. Candlesticks stand
 *  on it (room-art's CANDLESTICK). */
function pianoArt(): Art {
  const R: Rect[] = [];
  R.push([0, 0, 44, 1, "wood-hi"], [0, 1, 44, 2, "wood"], [0, 3, 44, 1, "wood-deep"]);
  R.push([1, 4, 42, 44, "wood-lo"], [1, 4, 1, 44, "wood"], [42, 4, 1, 44, "wood-deep"]);
  // Fretwork panels either side of the music.
  for (const x of [4, 30]) {
    R.push([x, 7, 10, 13, "wood-deep"], [x + 1, 8, 8, 11, "case-back"]);
    R.push(...g(["..WW..", ".W..W.", "W.WW.W", ".W..W.", "..WW..", "...W..", "..W.W.", ".W...W"], x + 2, 9));
  }
  R.push([15, 6, 14, 1, "wood-deep"], [16, 7, 12, 11, "paper"], [16, 7, 12, 1, "paper-lo"]);
  for (const y of [9, 12, 15]) R.push([17, y, 10, 1, "paper-lo"]);
  for (const [x, y] of [
    [18, 8],
    [21, 9],
    [24, 8],
    [19, 11],
    [23, 11],
    [25, 12],
    [18, 14],
    [22, 14],
    [20, 13],
  ])
    R.push([x, y, 1, 1, "ink"]);
  R.push([14, 18, 16, 1, "wood-hi"], [14, 19, 16, 1, "wood-deep"]);
  // Fallboard and keys.
  R.push([1, 21, 42, 2, "wood"], [1, 21, 42, 1, "wood-hi"], [2, 23, 40, 1, "wood-deep"]);
  R.push([3, 24, 38, 4, "paper"], [3, 27, 38, 1, "paper-lo"]);
  for (let x = 3, k = 0; x < 41; x += 2, k++) {
    if (k % 7 !== 2 && k % 7 !== 6) R.push([x + 1, 24, 1, 2, "ink"]);
    R.push([x, 26, 1, 1, "paper-lo"]);
  }
  R.push([1, 28, 42, 1, "wood-deep"], [0, 28, 3, 4, "wood"], [41, 28, 3, 4, "wood"], [0, 28, 1, 4, "wood-hi"]);
  // The lower panel, the pedals and the toes.
  R.push([4, 31, 36, 14, "wood-deep"], [5, 32, 34, 12, "wood"], [6, 33, 32, 10, "wood-lo"], [7, 34, 30, 8, "wood"]);
  R.push([17, 45, 2, 2, "brass"], [21, 45, 2, 2, "brass"], [25, 45, 2, 2, "brass"]);
  R.push([0, 48, 44, 2, "wood-deep"], [1, 44, 3, 4, "wood"], [40, 44, 3, 4, "wood"]);
  return { w: 44, h: 50, rects: R };
}

/** A gilded harp with red and blue strings among the white, 20 × 56. */
function harpArt(): Art {
  const R: Rect[] = [];
  // The neck curves from the top of the pillar down to the soundboard.
  const neck = [
    [4, 3],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
    [9, 5],
    [10, 6],
    [11, 7],
    [12, 8],
    [13, 8],
    [14, 9],
    [15, 10],
    [16, 11],
    [17, 12],
  ];
  const soundboard = (y: number) => Math.round(17 - ((y - 13) * 12) / 37);
  const neckY = (x: number) => Math.max(...neck.filter(([nx]) => nx === x).map(([, ny]) => ny)) + 2;
  for (let x = 5; x <= 16; x++) {
    let bottom = 13;
    while (bottom < 50 && soundboard(bottom) > x) bottom++;
    const paint = x % 7 === 0 ? "flower" : x % 7 === 3 ? "sea" : "paper";
    if (x % 2 === 1 || x % 7 === 0) R.push([x, neckY(x), 1, bottom - neckY(x), paint]);
  }
  for (const [x, y] of neck) R.push([x, y, 1, 2, "brass"], [x, y, 1, 1, "brass-hi"]);
  for (let y = 13; y <= 50; y++) {
    const x = soundboard(y);
    R.push([x, y, 2, 1, "wood"], [x + 2, y, 1, 1, "wood-deep"]);
  }
  R.push([2, 2, 3, 49, "brass"], [2, 2, 1, 49, "brass-hi"], [4, 2, 1, 49, "brass-lo"]);
  R.push(...g([".bBn.", "bBBBn", "nBBn."], 1, 0), ...g(["..bBn..", ".bBBBn.", "nnnnnnn"], 0, 47));
  R.push([2, 50, 16, 3, "brass-lo"], [2, 50, 16, 1, "brass"], [2, 53, 3, 3, "brass-lo"], [15, 53, 3, 3, "brass-lo"]);
  return { w: 20, h: 56, rects: R };
}

/** A cello standing on its spike, 14 × 52. */
function celloArt(): Art {
  const R: Rect[] = [];
  R.push(...g(["..??.", ".?!?.", ".?.?.", "..?.."], 5, 0));
  R.push([7, 4, 1, 4, "copper-lo"], [6, 4, 1, 4, "copper"], [5, 6, 1, 1, "ink"], [8, 6, 1, 1, "ink"]);
  R.push([6, 8, 2, 23, "ink"]);
  R.push(
    ...g(
      [
        "...?????...",
        "..?!9999?..",
        ".?!999999?.",
        ".?!999999?.",
        ".?!999999?.",
        ".?!999999?.",
        "..?!9999?..",
        "...?!99?...",
        "..?!9999?..",
        ".?!999999?.",
        "?!99999999?",
        "?!99999999?",
        "?!99999999?",
        "?!99999999?",
        "?!99999999?",
        ".?!999999?.",
        ".?!999999?.",
        "..??9999?..",
        "...?????...",
      ],
      1,
      24,
    ),
  );
  R.push([6, 24, 2, 9, "ink"], [6, 33, 1, 1, "paper-lo"], [7, 33, 1, 1, "paper-lo"]);
  R.push([4, 34, 1, 3, "ink"], [9, 34, 1, 3, "ink"], [5, 36, 1, 1, "ink"], [8, 36, 1, 1, "ink"]);
  R.push([5, 37, 4, 1, "paper-lo"], [6, 38, 2, 4, "ink"]);
  R.push([6, 8, 1, 30, "paper-lo"], [7, 8, 1, 30, "paper-lo"]);
  R.push([6, 43, 2, 1, "ink"], [6, 44, 1, 8, "metal"]);
  return { w: 14, h: 52, rects: R };
}

// ── Conservatory ─────────────────────────────────────────────────────────

/** A tall arched window of small panes onto the sky, `w` wide and 70
 *  tall, for the conservatory's wall. */
function archWindow(w: number): Art {
  const R: Rect[] = [];
  const h = 70;
  const mid = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    const dy = 10 - y;
    const half = y < 10 ? Math.sqrt(Math.max(0, mid * mid - (dy * mid * dy * mid) / 100)) : mid;
    const x0 = Math.ceil(mid - half);
    const x1 = Math.floor(mid + half);
    if (x1 < x0) continue;
    R.push([x0, y, x1 - x0 + 1, 1, "wood-deep"]);
    if (x1 - x0 > 2 && y > 0 && y < h - 2) R.push([x0 + 1, y, x1 - x0 - 1, 1, y < 26 ? "sky-hi" : "sky"]);
  }
  for (let x = 4; x < w - 3; x += 5) R.push([x, 3, 1, h - 5, "wood"]);
  for (let y = 16; y < h - 2; y += 9) R.push([1, y, w - 2, 1, "wood"]);
  R.push([3, 22, 1, 3, "glass-shine"], [4, 21, 1, 2, "glass-shine"], [w - 6, 40, 1, 3, "glass-shine"]);
  R.push([2, 30, 1, 1, "star"], [w - 5, 12, 1, 1, "star"], [Math.floor(mid), 50, 1, 1, "star"]);
  R.push([0, h - 2, w, 1, "wood-hi"], [0, h - 1, w, 1, "wood-deep"]);
  return { w, h, rects: R };
}

/** A big kentia palm in a glazed pot, 22 × 72: fronds arching out from
 *  its stems, leaflets hanging from each. */
const PALM: Art = (() => {
  const R: Rect[] = [];
  const seen = new Set<string>();
  const dot = (x: number, y: number, paint: Paint) => {
    const key = `${x},${y}`;
    if (x < 0 || x > 21 || y < 0 || seen.has(key)) return;
    seen.add(key);
    R.push([x, y, 1, 1, paint]);
  };
  // Three stems up from the pot, and fronds arching out from their tops:
  // where each starts, how far across it reaches, how high it rises
  // before its tip droops.
  const fronds: [number, number, number, number, number][] = [
    [11, 28, -11, 20, 0.85],
    [11, 28, 10, 20, 0.85],
    [11, 28, -3, 26, 0.35],
    [11, 28, 4, 24, 0.4],
    [9, 38, -9, 12, 0.75],
    [13, 36, 8, 12, 0.75],
    [10, 44, -7, 6, 0.6],
    [12, 44, 7, 6, 0.6],
  ];
  for (const [bx, by, reach, rise, droop] of fronds) {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(bx + reach * t);
      const y = Math.round(by - rise * t + droop * 30 * t * t);
      dot(x, y, "leaf");
      if (i % 2 === 0 && i > 2) {
        // Leaflets hang from the frond, longer towards its middle.
        const side = reach < 0 ? -1 : 1;
        const len = 1 + Math.round(3 * Math.sin(Math.PI * t));
        for (let k = 1; k <= len; k++) dot(x - side * Math.floor(k / 2), y + k, k === 1 ? "leaf-hi" : "leaf-lo");
      }
    }
  }
  line(R, 11, 60, 11, 29, "wood-lo");
  line(R, 10, 60, 9, 39, "leaf-lo");
  line(R, 12, 60, 13, 37, "leaf-lo");
  R.push(
    ...g(
      [
        "...ppppPPPPPPPPq...",
        "..pPPPPPPPPPPPPPq..",
        "..qqqqqqqqqqqqqqq..",
        "...pPPPPPPPPPPPq...",
        "...pPPbPPPPbPPPq...",
        "....pPPPPPPPPPq....",
        "....pPPPPPPPPPq....",
        ".....pPPPPPPPq.....",
        ".....qqqqqqqqq.....",
      ],
      2,
      61,
    ).filter(([x, y]) => !seen.has(`${x},${y}`)),
  );
  return { w: 22, h: 70, rects: R };
})();

/** A peacock chair of woven cane with a cushion, 24 × 46. */
const WICKER: Art = (() => {
  const R = g(
    [
      ".......//////.........",
      ".....//::;::://.......",
      "....//:;:;:;:;://.....",
      "...//:;:/:/:;:;://....",
      "..//:;:/::/::;:;://...",
      "..//:;:/::/::/;:;//...",
      ".//:;:/::/::/::;:;//..",
      ".//:;:/::/::/::/;:;//.",
      "//:;:/::/::/::/::;:;//",
      "//:;:/::/::/::/::/;:;/",
      "//:;:/::/::/::/::/;:;/",
      "//:;::/::/::/::/::;:;/",
      "//:;::/::/::/::/:;:;:/",
      ".//:;::/::/::/::;:;:/.",
      ".//:;:::/::/::/;:;:;/.",
      "..//:;:::/::/::;:;:/..",
      "..//:;:;:::::;:;:;:/..",
      "...//:;:;:;:;:;:;://..",
    ],
    1,
    0,
  );
  R.push([4, 18, 16, 3, "cushion"], [4, 18, 16, 1, "cushion-hi"], [4, 20, 16, 1, "cushion-lo"]);
  R.push([1, 17, 3, 9, "wicker"], [20, 17, 3, 9, "wicker"], [1, 17, 1, 9, "wicker-hi"], [22, 17, 1, 9, "wicker-lo"]);
  R.push([2, 21, 20, 3, "wicker-lo"], [2, 21, 20, 1, "wicker"]);
  // The base under the seat, waisted like an hourglass, woven in bands.
  for (let y = 24; y < 46; y++) {
    const inset = Math.round(7 - (5 * Math.abs(y - 33)) / (y < 33 ? 9 : 12));
    R.push([inset, y, 24 - 2 * inset, 1, y % 3 === 0 ? "wicker-lo" : "wicker"]);
    R.push([inset, y, 1, 1, "wicker-hi"], [23 - inset, y, 1, 1, "wicker-lo"]);
    if (y % 3 === 1) for (let x = inset + 2; x < 22 - inset; x += 3) R.push([x, y, 1, 1, "wicker-hi"]);
  }
  return { w: 24, h: 46, rects: R };
})();

/** A domed birdcage on a stand, 12 × 60. Its canary hops between perches
 *  (BIRD). */
function birdcageArt(): Art {
  const R: Rect[] = [];
  R.push(...g(["....bn....", "...n..n...", "....nn....", "..bBBBBn..", ".bBnnnnBn.", "bBn....nBn"], 1, 0));
  for (let x = 1; x <= 10; x += 2) R.push([x, 6, 1, 19, x < 5 ? "brass" : "brass-lo"]);
  R.push([0, 12, 12, 1, "brass-lo"], [3, 15, 6, 1, "wood"], [2, 21, 8, 1, "wood"]);
  R.push([0, 25, 12, 1, "brass-hi"], [0, 26, 12, 2, "brass"], [1, 28, 10, 1, "brass-lo"]);
  R.push([5, 29, 2, 26, "brass"], [5, 29, 1, 26, "brass-hi"], [4, 40, 4, 1, "brass-lo"]);
  R.push(...g(["...bBn...", "..bBBBn..", ".bBn.nBn.", "nn.....nn"], 1, 55), [1, 59, 10, 1, "brass-lo"]);
  return { w: 12, h: 60, rects: R };
}
const BIRD = [g([".,,.", ",K,'", ".,,'", "..b."], 6, 17), g(["..,,.", "',K,", "',,.", ".b.."], 3, 11)];

/** Ferns spilling over a tall plant stand, 18 × 50. */
const FERNS: Art = (() => {
  const R = g(
    [
      ".......gg.........",
      "....g.gGGj..g.....",
      "...gGgGjGgjgGg....",
      "..gGjGGjGGjGjGg...",
      ".gGjgGjGgGGjgGjg..",
      "gGj.gGjGGjGGj.jGg.",
      "Gj.gGj.gGGjgGj.jGg",
      "j..Gj..GjGj.Gj..jG",
      "..gj.pPPPPPPq.j...",
      ".gj..pPPPPPPq..j..",
      ".j...pPPPPPPq..Gj.",
      "j.....pPPPPq....j.",
      ".......pPPq.......",
    ],
    0,
    0,
  );
  R.push([3, 13, 12, 1, "wood-hi"], [3, 14, 12, 2, "wood"], [4, 16, 10, 1, "wood-deep"]);
  R.push([5, 17, 2, 30, "wood"], [5, 17, 1, 30, "wood-hi"], [11, 17, 2, 30, "wood"], [12, 17, 1, 30, "wood-lo"]);
  R.push([7, 30, 4, 1, "wood-lo"], [4, 47, 4, 3, "wood-deep"], [10, 47, 4, 3, "wood-deep"]);
  return { w: 18, h: 50, rects: R };
})();

// ── Games room ───────────────────────────────────────────────────────────

/** A dartboard over a chalked scoreboard, hung on the wall, 14 wide. */
function dartsArt(): Art {
  const R: Rect[] = [];
  const c = 6.5;
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r > 7) continue;
      const seg = Math.floor(((Math.atan2(y - c, x - c) + Math.PI) / (2 * Math.PI)) * 12) % 2;
      const paint =
        r > 6
          ? "ink"
          : r > 5
            ? seg
              ? "flower"
              : "leaf"
            : r > 2.2
              ? seg
                ? "paper"
                : "ink"
              : r > 1
                ? "leaf"
                : "flower";
      R.push([x, y, 1, 1, paint]);
    }
  }
  // Three darts in it.
  for (const [x, y] of [
    [4, 4],
    [8, 5],
    [6, 9],
  ])
    R.push([x, y, 1, 1, "brass-hi"], [x + 1, y - 1, 1, 1, "metal-hi"], [x + 2, y - 2, 1, 1, "flower"]);
  // The scoreboard.
  R.push([1, 18, 12, 12, "wood-deep"], [2, 19, 10, 10, "ink"]);
  for (const [x, y, w] of [
    [3, 20, 3],
    [8, 20, 3],
    [3, 23, 2],
    [8, 23, 3],
    [3, 26, 3],
    [9, 26, 2],
  ])
    R.push([x, y, w, 1, "paper-lo"]);
  R.push([7, 20, 1, 8, "paper-lo"], [3, 30, 4, 1, "wood-lo"]);
  return { w: 14, h: 31, rects: R };
}

/** A billiard table side on: green cloth, pockets, turned legs, balls and
 *  a cue on top, 60 × 28. */
function billiardsArt(): Art {
  const R: Rect[] = [];
  R.push(...g([".i.", "iii", ".i."], 14, 2), ...g([".,.", ",,,", ".,."], 20, 2), ...g([".y.", "yyy", ".y."], 31, 2));
  R.push(...g([".K.", "KKK", ".K."], 40, 2), ...g([".i.", "iii", ".i."], 44, 2));
  line(R, 6, 4, 26, 4, "wood-hi");
  R.push([5, 4, 1, 1, "paper"]);
  R.push([1, 5, 58, 1, "felt-hi"], [0, 6, 60, 1, "felt"], [0, 7, 60, 1, "felt-lo"]);
  R.push([0, 8, 60, 1, "wood-hi"], [0, 9, 60, 4, "wood"], [0, 13, 60, 1, "wood-deep"]);
  for (const x of [0, 29, 57]) R.push([x, 6, 3, 2, "ink"]);
  R.push([4, 10, 52, 2, "wood-lo"], [5, 10, 50, 1, "wood-deep"]);
  for (const x of [3, 29, 54]) {
    R.push([x, 14, 3, 14, "wood"], [x, 14, 1, 14, "wood-hi"], [x + 2, 14, 1, 14, "wood-lo"]);
    R.push(
      [x - 1, 17, 5, 3, "wood"],
      [x - 1, 17, 5, 1, "wood-hi"],
      [x - 1, 19, 5, 1, "wood-lo"],
      [x, 26, 3, 2, "wood-deep"],
    );
  }
  return { w: 60, h: 28, rects: R };
}
/** The lamp that hangs low over the billiard table: two green shades on a
 *  brass bar, 40 wide, on chains `drop` long from the ceiling. */
const lamps = new Map<number, Art>();
function billiardLamp(drop: number): Art {
  const known = lamps.get(drop);
  if (known) return known;
  const shade = ["....EE....", "...EEEE...", "..EEEEEE..", ".EEEEEEEE.", "EEEEEEEEEE", "bbbbbbbbbb", "...yFFy..."];
  const bar = drop - 9;
  const a: Art = {
    w: 40,
    h: drop,
    rects: [
      [10, 0, 1, bar, "brass-lo"],
      [29, 0, 1, bar, "brass-lo"],
      [2, bar, 36, 1, "brass"],
      [2, bar + 1, 36, 1, "brass-lo"],
      ...g(shade, 5, bar + 2),
      ...g(shade, 25, bar + 2),
    ],
  };
  lamps.set(drop, a);
  return a;
}

/** A game of chess on a pedestal table between two chairs, 32 × 32. */
function chessArt(): Art {
  const R: Rect[] = [];
  sideChair(R, 0, 1, 2, "chair");
  sideChair(R, 24, -1, 2, "chair");
  // White on the left, black on the right: a king, a rook and pawns.
  R.push(...g(["..y..", ".yyy.", "..y..", ".yyy.", ".yyy.", "yyyyy"], 10, 4));
  R.push(...g(["y.y", "yyy", "yyy"], 14, 7), [17, 8, 1, 2, "paper"], [16, 9, 1, 1, "paper"]);
  R.push(...g(["K.K.K", "KKKKK", ".KKK.", ".KKK.", "KKKKK"], 17, 5));
  R.push([20, 8, 1, 2, "ink"], [13, 8, 1, 2, "ink"]);
  R.push([9, 10, 14, 1, "ink"], ...Array.from({ length: 7 }, (_, i) => [9 + i * 2, 10, 1, 1, "paper"] as Rect));
  R.push([8, 11, 16, 1, "wood-hi"], [8, 12, 16, 1, "wood"], [9, 13, 14, 1, "wood-deep"]);
  R.push([15, 14, 2, 13, "wood"], [15, 14, 1, 13, "wood-hi"], [14, 20, 4, 2, "wood-lo"]);
  R.push(...g(["..wWWWd..", ".wW...Wd.", "DD.....DD"], 11, 27), [11, 30, 10, 2, "wood-deep"]);
  return { w: 32, h: 32, rects: R };
}

// ── Studio ───────────────────────────────────────────────────────────────

/** An easel with a landscape half painted, 26 × 62. */
function easelArt(): Art {
  const R: Rect[] = [];
  line(R, 12, 0, 2, 61, "wood", 2);
  line(R, 13, 0, 23, 61, "wood", 2);
  R.push([12, 2, 2, 56, "wood-lo"], [12, 0, 2, 2, "wood-hi"], [11, 10, 4, 2, "wood-deep"]);
  // The canvas.
  R.push([3, 12, 20, 26, "paper-lo"], [4, 13, 18, 24, "paper"]);
  R.push([4, 13, 18, 10, "art-sky"], [4, 13, 18, 3, "art-sky-hi"], ...g([".$$.", "$$$$", ".$$."], 16, 15));
  R.push(
    ...g(
      [
        "......^^^^^.......",
        "...^^^^^^^^^^^....",
        "^^^^^^^^^^^^^^^^^^",
        "^^^^^^^^^^^^^^^^^^",
        "~~~~~~~~^^^^^^^^^^",
        "--~~~~~~~~~^^^^^^^",
      ],
      4,
      21,
    ),
  );
  R.push(...g([".GG.", "GGjG", "GjGG", ".d.."], 14, 19));
  // Still to paint: a pencilled outline on the bare canvas.
  R.push([4, 28, 18, 8, "paper"], [6, 31, 5, 1, "paper-lo"], [12, 30, 1, 4, "paper-lo"], [15, 32, 5, 1, "paper-lo"]);
  R.push([2, 38, 22, 2, "wood"], [2, 38, 22, 1, "wood-hi"], [3, 40, 20, 1, "wood-deep"]);
  R.push(...g(["i~$", "iG$"], 7, 36));
  return { w: 26, h: 62, rects: R };
}

/** A table of paints: brushes in a jar, pots, and a palette, 24 × 30. */
function paintsArt(): Art {
  const R: Rect[] = [];
  for (const [x, y, tip] of [
    [3, 1, "flower"],
    [5, 0, "sea"],
    [6, 2, "shade"],
    [4, 3, "leaf"],
  ] as const) {
    R.push([x, y, 1, 1, tip], [x, y + 1, 1, 6 - y + 1, "wood-hi"]);
  }
  R.push(...g(["aAAAAv", "AAAAAv", "AvAAAv", "AAAAAv", "AAAAvv", ".vvvv."], 1, 8));
  R.push(...g([".nn.", "iiii", "iiii", "iiii"], 8, 10), ...g([".nn.", "~~~~", "~~~~", "~~~~"], 12, 10));
  R.push(...g(["...wwww.", ".wwWWWWw", "wWiWW~Wd", "wW$WWWWd", "wWWWGWd.", ".dWWWd..", "..ddd..."], 16, 6));
  R.push([0, 14, 24, 1, "wood-hi"], [0, 15, 24, 1, "wood"], [0, 16, 24, 1, "wood-deep"]);
  R.push([4, 15, 1, 1, "flower"], [11, 16, 1, 1, "sea"], [19, 15, 1, 1, "shade"]);
  R.push([1, 17, 2, 13, "wood"], [1, 17, 1, 13, "wood-hi"], [21, 17, 2, 13, "wood"], [22, 17, 1, 13, "wood-lo"]);
  R.push([3, 24, 18, 1, "wood-lo"], ...g(["..nnnn..nnnn", ".nMMMM.nMMMM", ".n====.n====", "UUUUVVUUUUV."], 6, 20));
  return { w: 24, h: 30, rects: R };
}

/** A marble bust crowned with laurel, on a fluted column, 14 × 54. */
const BUST: Art = (() => {
  const R = g(
    [
      "....]]]]]]....",
      "..gG[]]]]]Gg..",
      "..jg[]]]]]gj..",
      "...[]]]]]]|...",
      "...[]|]]|]|...",
      "...[]]]]]]|...",
      "...[]]]|]]|...",
      "...[]]]]]]|...",
      "....[]||]|....",
      ".....[]]|.....",
      ".....[]]|.....",
      "...[[]]]]]|...",
      "..[]]]]]]]]|..",
      ".[]]]|]]]]]]|.",
      ".[]]]]|]]]]]|.",
      "[]]]]]]|]]]]]|",
      "[]]]]]]]|]]]]|",
      "||||||||||||||",
    ],
    0,
    0,
  );
  R.push([1, 18, 12, 2, "marble"], [1, 18, 12, 1, "marble-hi"], [2, 20, 10, 1, "marble-lo"]);
  R.push([3, 21, 8, 26, "marble"], [3, 21, 1, 26, "marble-hi"]);
  for (const x of [5, 7, 9]) R.push([x, 21, 1, 26, "marble-lo"]);
  R.push(
    [2, 47, 10, 1, "marble-lo"],
    [1, 48, 12, 2, "marble"],
    [1, 48, 12, 1, "marble-hi"],
    [0, 50, 14, 4, "marble"],
    [0, 50, 14, 1, "marble-hi"],
    [0, 53, 14, 1, "marble-lo"],
  );
  return { w: 14, h: 54, rects: R };
})();

// ── Bathroom ─────────────────────────────────────────────────────────────

const flip = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(""));

/** A roll-top bath on brass claw feet, heaped with bubbles with a rubber
 *  duck afloat on them, and a standpipe mixer at its foot, 50 × 34. More
 *  bubbles rise off it (BATH_BUBBLES). */
function bathArt(): Art {
  const R: Rect[] = [];
  // Claw feet under the curve of the tub.
  const foot = ["......bn", ".....bBn", "....bBn.", "...bBBn.", ".bBbBbBn", "nnnnnnn."];
  R.push(...g(foot, 4, 28), ...g(flip(foot), 34, 28));
  // The tub, painted outside, curving under to its foot.
  for (let t = 0; t <= 14; t++) {
    const y = 14 + t;
    const inset = Math.floor(t / 3) + [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 7][t];
    const x0 = 1 + inset;
    const x1 = 44 - inset;
    const fill = t === 0 || t === 14 ? "chair-deep" : t < 4 ? "chair-hi" : t < 11 ? "chair" : "chair-lo";
    R.push([x0, y, x1 - x0 + 1, 1, fill]);
    if (t > 0 && t < 14) R.push([x0, y, 1, 1, t < 11 ? "chair-hi" : "chair"], [x1, y, 1, 1, "chair-deep"]);
  }
  // A gilt line round it under the rim.
  R.push([2, 16, 42, 1, "brass"], [2, 16, 1, 1, "brass-hi"], [43, 16, 1, 1, "brass-lo"]);
  // The rolled rim, white enamel.
  R.push([1, 11, 44, 1, "marble-hi"], [0, 12, 46, 1, "marble"], [1, 13, 44, 1, "marble-lo"]);
  R.push([0, 12, 1, 1, "marble-hi"], [45, 12, 1, 1, "marble-lo"]);
  // The bubbles: a heap of round suds, the ones at the back first, each
  // lit from the top left; a few spill over the rim.
  R.push([2, 9, 42, 2, "glass"]);
  const suds: [number, number, number][] = [
    [19.4, 1.8, 1.9],
    [14.2, 2.6, 1.8],
    [28.2, 2.8, 1.6],
    [21.2, 3.8, 3.3],
    [35.2, 4.2, 1.6],
    [16.8, 4.8, 3],
    [25.8, 5, 3],
    [12.3, 5.8, 3.1],
    [29.8, 6, 2.8],
    [33.6, 6.8, 2.9],
    [8.2, 7.3, 2.8],
    [37.6, 7.8, 2.6],
    [4.6, 8.7, 2.2],
    [41.3, 8.9, 2],
    [23.5, 7.8, 2.2],
    [18.5, 8.2, 2],
    [9.6, 11.4, 1.4],
    [31.2, 11.5, 1.2],
  ];
  for (const [cx, cy, r] of suds) {
    for (let y = Math.max(0, Math.ceil(cy - r)); y <= cy + r; y++) {
      for (let x = Math.ceil(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const lean = (x - cx + y - cy) / r;
        R.push([x, y, 1, 1, lean > 0.75 && d > r * 0.5 ? "glass" : "glass-hi"]);
        if (lean < -0.85 && r > 1.7) R.push([x, y, 1, 1, "glass-shine"]);
      }
    }
  }
  // A rubber duck afloat.
  R.push(...g(["..,,....", "!,K,....", "..,,..,.", ".,,,,,,'", "..,,,,''"], 22, 0));
  R.push([23, 5, 5, 1, "glass-hi"], [22, 4, 2, 1, "glass-hi"], [27, 5, 3, 1, "glass"]);
  // The mixer: a standpipe from the floor with a crosshead tap, and a
  // spout over the rim.
  R.push(...g([".bbbbbn..", "bBBBBBBn.", "nn...bBn.", "n....bBn."], 41, 3));
  R.push([46, 7, 1, 24, "brass-hi"], [47, 7, 1, 24, "brass"], [48, 7, 1, 24, "brass-lo"]);
  R.push(...g(["..b..", "bBBBn", "..n..", ".bBn.", ".nBn."], 45, 13));
  R.push(...g([".bBn.", "bBBBn", "nnnnn"], 45, 31));
  return { w: 50, h: 34, rects: R };
}
/** Soap bubbles rising off the bath: a ring with a glint, and a speck. */
const BATH_BUBBLES = [g([".a.", "A.v", ".v."]), g(["av", "vA"])];

/** A marble-topped washstand: a jug standing in its basin, the soap, and
 *  towels folded on the shelf beneath, 22 × 44. */
function washstandArt(): Art {
  const R: Rect[] = [];
  // A marble splashback, shaped at the top, with a vein or two.
  R.push(...g(["....[[[[[[[[[[....", "..[[]]]]]]]]]]]]..", ".[]]]]]]]]]]]]]]].", "[]]]]]]]]]]]]]]]]|"], 2, 8));
  R.push([2, 12, 18, 6, "marble"], [2, 12, 1, 6, "marble-hi"], [19, 12, 1, 6, "marble-lo"]);
  line(R, 5, 10, 9, 14, "marble-lo");
  line(R, 14, 9, 17, 13, "marble-lo");
  // The basin and the jug in it, white china banded in blue.
  R.push(
    ...g(
      [
        "yyyyyy...",
        ".yyyyYY.y",
        "..yyY..yY",
        "..yyY...Y",
        ".yyyyY..Y",
        "y~~~~~Y.Y",
        "y~y~y~YYY",
        "yyyyyyY..",
        "yyyyyyY..",
        ".yyyyY...",
      ],
      6,
      3,
    ),
  );
  R.push(...g(["yyyyyyyyyyyyyy", ".~~~~~~~~~~~~.", "..yyyyyyyyyY..", "...YYYYYYYY..."], 3, 14));
  R.push(...g(["....", ".ii.", "YyyY"], 17, 15));
  // The marble top.
  R.push([0, 18, 22, 1, "marble-hi"], [0, 19, 22, 1, "marble"], [0, 20, 22, 1, "marble-lo"]);
  // A frieze with a drawer, on turned legs.
  R.push([1, 21, 20, 5, "wood"], [1, 21, 20, 1, "wood-deep"], [1, 25, 20, 1, "wood-deep"]);
  R.push([3, 22, 16, 3, "wood-lo"], [4, 23, 14, 1, "wood"], [10, 23, 2, 1, "brass"]);
  for (const x of [1, 18]) {
    R.push([x, 26, 3, 14, "wood"], [x, 26, 1, 14, "wood-hi"], [x + 2, 26, 1, 14, "wood-lo"]);
    R.push([x, 28, 3, 2, "wood-lo"], [x - (x === 1 ? 0 : 0), 31, 3, 1, "wood-hi"], [x, 37, 3, 1, "wood-lo"]);
    R.push([x, 40, 3, 2, "wood-deep"]);
  }
  // The shelf: folded towels and a jar of bath salts.
  R.push(...g(["VUUUUUUV", "UUUUUUUU", "VVVVVVVV", "UUUUUUUU", "VVVVVVVV"], 4, 29));
  R.push([5, 30, 6, 1, "cushion-hi"], [5, 32, 6, 1, "cushion-hi"]);
  R.push(...g([".nn.", "aAAv", "aiAv", "AAiv", "vvvv"], 14, 29));
  R.push([1, 34, 20, 1, "wood-hi"], [1, 35, 20, 1, "wood-deep"]);
  return { w: 22, h: 44, rects: R };
}
/** An oval looking glass in a gilt frame, hung over the washstand on a
 *  cord, 16 × 26. */
const MIRROR: Art = (() => {
  const R: Rect[] = [];
  line(R, 8, 0, 3, 7, "brass-lo");
  line(R, 8, 0, 13, 7, "brass-lo");
  const cx = 7.5;
  const cy = 16;
  const rx = 7.5;
  const ry = 9.5;
  for (let y = 6; y < 26; y++) {
    for (let x = 0; x < 16; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      const inner = ((x - cx) / (rx - 1.7)) ** 2 + ((y - cy) / (ry - 1.7)) ** 2;
      const lean = x - cx + (y - cy) * 0.8;
      if (inner > 1) R.push([x, y, 1, 1, lean < -4 ? "brass-hi" : lean > 4 ? "brass-lo" : "brass"]);
      else R.push([x, y, 1, 1, lean < -3 ? "glass-hi" : lean > 4 ? "glass-lo" : "glass"]);
    }
  }
  // A shell at the crown of the frame; the glass's shine.
  R.push(...g([".bBn.", "bBnBn", ".nBn."], 5, 5));
  line(R, 4, 16, 7, 12, "glass-shine");
  line(R, 5, 19, 9, 14, "glass-shine");
  line(R, 9, 22, 11, 19, "glass-shine");
  return { w: 16, h: 26, rects: R };
})();

/** A towel horse with a striped bath towel over the top rail and a hand
 *  towel over the lower one, 14 × 46. */
function towelsArt(): Art {
  const R: Rect[] = [];
  // The uprights, with knobs on top and splayed feet.
  for (const x of [0, 12]) {
    R.push(...g([".ww.", "wWWd", ".dd."], x - 1, 0).filter(([rx]) => rx >= 0 && rx < 14));
    R.push([x, 3, 2, 39, "wood"], [x, 3, 1, 39, x ? "wood" : "wood-hi"], [x + 1, 3, 1, 39, x ? "wood-deep" : "wood-lo"]);
  }
  R.push(...g(["wWd.......wWd.", "WWWd....wWWWd", "DDDD....DDDDDD"], 0, 42).filter(([rx, , w]) => rx + w <= 14));
  R.push([2, 38, 10, 1, "wood-lo"], [2, 7, 10, 2, "wood"], [2, 26, 10, 2, "wood"]);
  // The bath towel: folded over the rail, front and back, striped near
  // its fringed ends.
  R.push([2, 21, 10, 2, "chair-lo"], [3, 23, 8, 1, "chair-deep"]);
  R.push([3, 6, 8, 1, "chair-hi"], [2, 7, 10, 14, "chair"], [2, 7, 1, 14, "chair-hi"], [11, 7, 1, 14, "chair-lo"]);
  R.push([5, 8, 1, 12, "chair-lo"], [8, 9, 1, 11, "chair-lo"], [7, 8, 1, 12, "chair-hi"]);
  R.push([2, 15, 10, 1, "paper"], [2, 17, 10, 1, "paper"], [2, 16, 10, 1, "chair-deep"]);
  for (let x = 2; x < 12; x += 2) R.push([x, 21, 1, 1, "chair-hi"]);
  // The hand towel on the lower rail.
  R.push([4, 25, 6, 1, "cushion-hi"], [3, 26, 8, 11, "cushion"], [3, 26, 1, 11, "cushion-hi"], [10, 26, 1, 11, "cushion-lo"]);
  R.push([6, 27, 1, 9, "cushion-lo"], [3, 33, 8, 1, "paper"], [3, 36, 8, 1, "cushion-lo"]);
  return { w: 14, h: 46, rects: R };
}

// ── Dining room ──────────────────────────────────────────────────────────

/** A sideboard with a decanter, a tazza of fruit and a candlestick on it,
 *  34 × 40. */
function sideboardArt(): Art {
  const R: Rect[] = [];
  // A low gallery at the back.
  R.push([3, 10, 28, 4, "wood"], [3, 10, 28, 1, "wood-hi"], [3, 10, 1, 4, "wood-hi"], [30, 10, 1, 4, "wood-deep"]);
  // A decanter of sherry and a glass.
  R.push(...g(["..a..", ".aAv.", "..A..", "..A..", ".aAv.", "aA??v", "a!??v", "a???v", "a???v", ".vvv."], 3, 3));
  R.push(...g(["av", "?v", ".v", "vv"], 9, 10));
  // The tazza: apple, orange, pear and grapes heaped in a gilt dish.
  disc(R, 14.5, 6.5, 2.3, "cap");
  R.push([13, 5, 1, 1, "flower"]);
  disc(R, 20, 6.7, 2.3, "copper");
  R.push([19, 5, 1, 1, "copper-hi"], [21, 8, 1, 1, "copper-lo"]);
  R.push(...g(["..d..", ".gg..", ".gGj.", "gGGGj", "gGGjj"], 15, 1));
  R.push(...g(["~~-.", "~-~-", ".~~-", "..-."], 20, 8));
  R.push(...g(["bbbbbbbbbbbb", ".nBBBBBBBBn.", "...nBBBBn...", ".....Bn.....", "...nnBBnn..."], 11, 9));
  // A silver candlestick, lit.
  R.push(...g([".F.", ".f.", ".y.", ".y.", ".y.", ".Y.", "+M=", ".M.", ".M=", "+M="], 26, 4));
  // The top, three drawers and three doors, on short legs.
  R.push([0, 14, 34, 1, "wood-hi"], [0, 15, 34, 1, "wood"], [0, 16, 34, 1, "wood-deep"]);
  R.push([1, 17, 32, 18, "wood"], [1, 17, 1, 18, "wood-hi"], [32, 17, 1, 18, "wood-deep"]);
  for (const x of [3, 13, 23]) {
    R.push([x, 18, 8, 4, "wood-lo"], [x + 1, 19, 6, 2, "wood"], [x + 3, 20, 2, 1, "brass"]);
    R.push([x, 23, 8, 11, "wood-lo"], [x + 1, 24, 6, 9, "wood"], [x + 1, 24, 6, 1, "wood-hi"], [x + 1, 24, 1, 9, "wood-hi"]);
  }
  R.push(...g(["..ww..", ".w..w.", "w....d", ".d..d.", "..dd.."], 14, 26));
  R.push([11, 28, 1, 2, "brass"], [22, 28, 1, 2, "brass"]);
  R.push([0, 34, 34, 1, "wood-deep"], [0, 35, 34, 1, "wood"], [1, 36, 32, 1, "wood-deep"]);
  for (const x of [1, 30]) R.push([x, 37, 3, 1, "wood"], [x + 1, 37, 1, 3, "wood-lo"], [x, 37, 1, 2, "wood-hi"]);
  return { w: 34, h: 40, rects: R };
}

/** A dining chair seen from the side, upholstered in the room's fabric,
 *  facing right (or left), 9 × 34. */
function diningChair(R: Rect[], x: number, facing: 1 | -1) {
  const at = (dx: number, w = 1) => (facing === 1 ? x + dx : x + 8 - dx - w + 1);
  // The back: a post with a finial and a padded back on its inner side.
  R.push([at(0, 2), 1, 2, 33, "wood"], [at(0), 1, 1, 33, facing === 1 ? "wood-hi" : "wood-lo"], [at(0, 2), 0, 2, 1, "wood-hi"]);
  R.push([at(2), 3, 1, 12, "chair"], [at(2), 3, 1, 1, "chair-hi"], [at(2), 14, 1, 1, "chair-lo"], [at(3), 4, 1, 10, "chair-lo"]);
  // The seat, its rail, and the turned front leg.
  R.push([at(1, 8), 17, 8, 1, "chair-hi"], [at(1, 8), 18, 8, 2, "chair"], [at(1, 8), 19, 8, 1, "chair-lo"]);
  R.push([at(0, 9), 20, 9, 1, "wood-hi"], [at(0, 9), 21, 9, 1, "wood-deep"]);
  R.push([at(7, 2), 22, 2, 12, "wood"], [at(7), 22, 1, 12, facing === 1 ? "wood-hi" : "wood-lo"]);
  R.push([at(6, 3), 25, 3, 2, "wood"], [at(6, 3), 25, 3, 1, "wood-hi"], [at(2, 5), 29, 5, 1, "wood-lo"]);
}

/** The dining table under a long cloth, laid for two with plates,
 *  glasses, a roast and candles, a chair at each end, 50 × 34. The
 *  chandelier hangs over it. */
function diningArt(): Art {
  const R: Rect[] = [];
  diningChair(R, 0, 1);
  diningChair(R, 41, -1);
  // The legs, under the cloth.
  for (const x of [12, 36]) {
    R.push([x, 21, 2, 13, "wood"], [x, 21, 1, 13, "wood-hi"], [x - 1, 26, 4, 2, "wood"], [x - 1, 26, 4, 1, "wood-hi"]);
    R.push([x - 1, 32, 4, 2, "wood-deep"]);
  }
  // The cloth, hanging in folds to a scalloped hem.
  R.push([9, 13, 32, 1, "paper"], [9, 14, 32, 6, "paper"], [9, 14, 32, 1, "paper-lo"]);
  for (const x of [13, 18, 24, 30, 35]) R.push([x, 15, 1, 5, "paper-lo"]);
  for (let x = 9; x < 41; x++) R.push([x, 20, 1, 1, x % 3 === 1 ? "paper-lo" : "paper"]);
  for (let x = 10; x < 40; x += 3) R.push([x, 21, 1, 1, "paper-lo"]);
  R.push([9, 21, 1, 1, "paper"], [40, 21, 1, 1, "paper"]);
  // Plates and glasses at each place.
  for (const x of [11, 34]) R.push(...g([".~~~~.", "yyyyyY"], x, 11));
  for (const x of [17, 31]) R.push(...g(["aAv", "a0v", ".v.", ".A.", "vAv"], x, 8));
  // A roast fowl on a platter between two candlesticks.
  R.push(...g(["..!!!..", ".!999?.", "y!9999?", ".??????", "yYYYYYY"], 22, 8));
  R.push([23, 12, 6, 1, "paper"], [21, 12, 1, 1, "paper"], [29, 12, 1, 1, "paper-lo"]);
  for (const x of [19, 29]) R.push(...g([".F.", ".f.", ".y.", ".y.", ".Y.", ".B.", "bBn"], x, 6));
  return { w: 50, h: 34, rects: R };
}

/** A crystal chandelier of six candles on a chain `drop` long, 23 wide. */
const chandeliers = new Map<number, Art>();
function chandelierArt(drop: number): Art {
  const known = chandeliers.get(drop);
  if (known) return known;
  const body = [
    "..........nBn..........",
    "......f...bBn...f......",
    "......F....B....F......",
    "......y...bBn...y......",
    ".f....y..bBBBn..y....f.",
    ".F...bBn.nBBn..bBn...F.",
    ".y...nBBBBBBBBBBBn...y.",
    ".y......a.nBn.a......y.",
    "bBn.....A.bBn.A.....bBn",
    "nBBn.......B.......nBBn",
    "..nBBBBBBBbBnBBBBBBBn..",
    "...a...a..nBBn..a...a..",
    "...A...a...Bn...a...A..",
    "...a...A..bBn...A...a..",
    "...........n...........",
    "..........aAv..........",
    "...........v...........",
  ];
  const top = drop - body.length;
  const R: Rect[] = [];
  for (let y = 0; y < top; y++) R.push([11, y, 1, 1, y % 2 ? "brass" : "brass-lo"]);
  R.push(...g(body, 0, top));
  const a: Art = { w: 23, h: drop, rects: R };
  chandeliers.set(drop, a);
  return a;
}

/** A glazed china cabinet: plates, a teapot and cups, a tureen and glasses
 *  behind the glass, drawers and a cupboard below, 22 × 80. */
function cabinetArt(): Art {
  const R: Rect[] = [];
  // Cornice with a little crest.
  R.push(...g(["......wwwwwwwwww......", "....wwWWWWWWWWWWdd....", "..wWWWWWWWWWWWWWWWWd.."], 0, 0));
  R.push([0, 3, 22, 1, "wood-deep"], [0, 4, 22, 1, "wood-hi"], [0, 5, 22, 1, "wood"], [1, 6, 20, 1, "wood-deep"]);
  for (let x = 1; x < 21; x += 2) R.push([x, 5, 1, 1, "wood-lo"]);
  // The case, and the glazed door with an arched top.
  R.push([1, 7, 20, 44, "wood"], [1, 7, 1, 44, "wood-hi"], [20, 7, 1, 44, "wood-deep"]);
  R.push([3, 9, 16, 40, "wood-deep"], [4, 10, 14, 38, "case-back"]);
  R.push([4, 10, 3, 1, "wood-deep"], [4, 11, 1, 1, "wood-deep"], [15, 10, 3, 1, "wood-deep"], [17, 11, 1, 1, "wood-deep"]);
  for (const y of [22, 34]) R.push([4, y, 14, 1, "wood-hi"], [4, y + 1, 14, 1, "wood-lo"]);
  // China: two plates on the top shelf, rose-patterned with gilt rims.
  const plate = (x: number, y: number) =>
    R.push(...g(["..bbb..", ".byyyb.", "byiyyyn", "byyGyyn", "byyyiyn", ".nyyyn.", "..nnn.."], x, y));
  plate(4, 14);
  plate(11, 14);
  R.push([4, 21, 14, 1, "case-shadow"]);
  // A teapot and two cups on saucers.
  R.push(...g(["...nb...", ".yyyyy..", "yyiyyyyy", "yiiiyyY.", "yyyyyyY.", ".YYYYY.."], 4, 27));
  R.push(...g(["yyyb", "yiyb", ".YY.", "YYYY"], 12, 29), ...g(["yyyb", "yyib", ".YY.", "YYYY"], 15, 29).filter(([rx]) => rx < 18));
  // A tureen and a pair of glasses.
  R.push(...g(["..nb..", ".yyyy.", "byyyyb", "yyiiyY", ".yyyY.", "..YY..", ".YYYY."], 4, 41));
  R.push(...g(["aAv", "aAv", ".A.", ".A.", "vAv"], 11, 42), ...g(["aAv", "aAv", ".A.", ".A.", "vAv"], 14, 42));
  // The glass, catching the light.
  line(R, 5, 17, 9, 12, "glass-shine");
  line(R, 6, 20, 11, 15, "glass-shine");
  line(R, 12, 45, 16, 40, "glass-shine");
  line(R, 13, 47, 17, 42, "glass-shine");
  R.push([3, 49, 16, 1, "wood-hi"], [17, 29, 1, 3, "brass"]);
  // A moulding, two drawers and a cupboard, on bun feet.
  R.push([0, 51, 22, 1, "wood-hi"], [0, 52, 22, 1, "wood"], [0, 53, 22, 1, "wood-deep"]);
  R.push([1, 54, 20, 22, "wood"], [1, 54, 1, 22, "wood-hi"], [20, 54, 1, 22, "wood-deep"]);
  for (const x of [3, 12]) R.push([x, 55, 7, 5, "wood-lo"], [x + 1, 56, 5, 3, "wood"], [x + 2, 57, 3, 1, "brass"]);
  for (const x of [3, 11]) {
    R.push([x, 61, 8, 13, "wood-lo"], [x + 1, 62, 6, 11, "wood"], [x + 2, 63, 4, 9, "wood-lo"], [x + 3, 64, 2, 7, "wood"]);
  }
  R.push([10, 66, 1, 2, "brass"], [11, 66, 1, 2, "brass"]);
  R.push([0, 75, 22, 1, "wood-deep"], [0, 76, 22, 1, "wood"], [0, 77, 22, 1, "wood-deep"]);
  R.push(...g(["wWWd............wWWd", ".DD..............DD."], 1, 78));
  return { w: 22, h: 80, rects: R };
}

// ── Nursery ──────────────────────────────────────────────────────────────

/** A cot with turned spindles, a quilt and a pillow, and a drawer under
 *  it, 40 × 42. A mobile turns over it (mobileArt). */
function cotArt(): Art {
  const R: Rect[] = [];
  // Behind the bars: the mattress, the pillow and the quilt.
  R.push([3, 25, 34, 6, "paper"], [3, 30, 34, 1, "paper-lo"]);
  R.push(...g(["..yyyyyyy.", ".yyyyyyyyY", "yyyyyyyyYY", ".YYYYYYYY."], 26, 19));
  R.push([3, 20, 23, 7, "cushion"], [3, 20, 23, 1, "cushion-hi"], [3, 26, 23, 1, "cushion-lo"], [23, 19, 4, 2, "paper"]);
  for (const [x, y] of [
    [5, 22],
    [11, 24],
    [16, 22],
    [21, 24],
    [8, 25],
  ])
    R.push([x - 1, y, 3, 1, "paper"], [x, y - 1, 1, 3, "paper"]);
  // The posts with their finials, the rails and the spindles.
  for (const x of [0, 37]) {
    R.push(...g([".w.", "wWd", "WWd", ".D."], x, 1));
    R.push([x, 5, 3, 34, "wood"], [x, 5, 1, 34, "wood-hi"], [x + 2, 5, 1, 34, "wood-deep"]);
    R.push([x, 8, 3, 1, "wood-lo"], [x, 35, 3, 1, "wood-lo"]);
  }
  R.push([3, 10, 34, 1, "wood-hi"], [3, 11, 34, 1, "wood"], [3, 12, 34, 1, "wood-deep"]);
  for (let x = 5; x < 36; x += 3) {
    R.push([x, 13, 1, 18, "wood"], [x, 16, 1, 1, "wood-hi"], [x, 27, 1, 1, "wood-hi"]);
  }
  R.push([3, 31, 34, 1, "wood-hi"], [3, 32, 34, 1, "wood"], [3, 33, 34, 1, "wood-deep"]);
  // A drawer for blankets underneath, and the feet.
  R.push([4, 34, 32, 5, "wood-lo"], [5, 35, 30, 3, "wood"], [5, 35, 30, 1, "wood-hi"], [19, 36, 2, 1, "brass"]);
  R.push([0, 39, 3, 3, "wood-deep"], [37, 39, 3, 3, "wood-deep"], [1, 41, 1, 1, "brass"], [38, 41, 1, 1, "brass"]);
  return { w: 40, h: 42, rects: R };
}

/** The mobile over the cot, on a cord `drop` long, 25 wide: a star and a
 *  moon on the upper arm, a heart and a cloud on the lower one, in three
 *  positions as it twists one way and back (room-swing). */
const mobiles = new Map<number, { art: Art; frames: Rect[][] }>();
function mobileArt(drop: number) {
  const known = mobiles.get(drop);
  if (known) return known;
  const cx = 12;
  const arm1 = drop - 21;
  const arm2 = drop - 11;
  const R: Rect[] = [];
  for (let y = 0; y < arm1 - 1; y++) R.push([cx, y, 1, 1, "wood-lo"]);
  R.push(...g(["wW", "Wd"], cx, arm1 - 2).map(([x, y, w, h, p]) => [x - 0.5 > 0 ? x : x, y, w, h, p] as Rect));
  const star = [".,.", ",,,", "',,", "'.'"].map((r) => r);
  const shapes = {
    star: ["..,..", ",,,,,", ".,,'.", ".'.'."],
    moon: [".yy", "yY.", "yY.", "yY.", ".yy"],
    heart: [".i.i.", "iiiii", ".iii.", "..i.."],
    cloud: [".aa..", "aaaaa", "AAAAv"],
  } as const;
  void star;
  const hang = (frame: Rect[], x: number, y: number, shape: readonly string[]) => {
    const w = shape[0].length;
    frame.push([x, y + 1, 1, 2, "wood-lo"]);
    frame.push(...g(shape, x - Math.floor(w / 2), y + 3));
  };
  const frames = [20, 45, 70].map((deg) => {
    const F: Rect[] = [];
    const t = (deg * Math.PI) / 180;
    const o1 = Math.round(10 * Math.cos(t));
    const o2 = Math.round(8 * Math.sin(t));
    F.push([cx - o1, arm1, 2 * o1 + 1, 1, "wood"], [cx, arm1 + 1, 1, arm2 - arm1 - 1, "wood-lo"]);
    F.push([cx - o2, arm2, 2 * o2 + 1, 1, "wood"]);
    hang(F, cx - o1, arm1, shapes.moon);
    hang(F, cx + o1, arm1, shapes.star);
    hang(F, cx + o2, arm2, shapes.heart);
    hang(F, cx - o2, arm2, shapes.cloud);
    return F;
  });
  const m = { art: { w: 25, h: drop, rects: R }, frames };
  mobiles.set(drop, m);
  return m;
}

/** A painted toy box, its lid open and a teddy peeping out, with a ball
 *  and a toy boat's sail beside him, 22 × 30. */
function toyboxArt(): Art {
  const R: Rect[] = [];
  const BEAR = { o: "wicker-hi", O: "wicker", h: "wicker-lo" };
  // The lid, open against the wall.
  R.push([1, 3, 20, 11, "wood-deep"], [2, 4, 18, 10, "wood-lo"], [2, 4, 18, 1, "wood"], [3, 6, 16, 1, "wood-deep"]);
  // A sail and a pennant, a ball, and the teddy.
  R.push([16, 2, 1, 12, "wood-lo"], ...gk({ r: "red" }, ["r..", "rr.", "rrr"], 17, 2), ...g(["y.", "yy", "yyy", "yyyy", "yYYY"].map((r) => r.padEnd(4, ".")), 17, 6));
  disc(R, 3.5, 11.5, 2.5, "sea");
  R.push([2, 11, 4, 1, "paper"], [2, 10, 1, 1, "paper"], [5, 13, 1, 1, "sea-lo"], [4, 14, 2, 1, "sea-lo"]);
  R.push(
    ...gk(BEAR, [".oO....oO.", "oOhOOOOhOh", ".OOOOOOOO.", "OOKOOOOKOh", "OOOooooOOh", "OOooKKooOh", ".OOoooOOh.", "..ii.ii...", ".OOiiiOO.."], 5, 6),
  );
  R.push(...gk(BEAR, ["oOh", "OOh"], 4, 14));
  // The box: a rim, two panels painted with a star and a heart, a plinth.
  R.push([0, 15, 22, 1, "wood-hi"], [0, 16, 22, 1, "wood"], [0, 17, 22, 1, "wood-deep"]);
  R.push([1, 18, 20, 9, "wood"], [1, 18, 1, 9, "wood-hi"], [20, 18, 1, 9, "wood-deep"]);
  R.push(...gk(BEAR, ["oOh", "OOh"], 4, 14));
  for (const x of [3, 12]) R.push([x, 19, 7, 7, "wood-lo"], [x + 1, 20, 5, 5, "wood-hi"], [x + 1, 20, 5, 1, "paper"]);
  R.push(...g(["..,..", ",,,,,", ".,,,.", ".,.,."], 4, 20));
  R.push(...gk({ r: "red", R: "red-lo" }, [".r.r.", "rrrrR", ".rrR.", "..R.."], 13, 21));
  R.push([0, 27, 22, 1, "wood-deep"], [0, 28, 3, 2, "wood-deep"], [19, 28, 3, 2, "wood-deep"]);
  return { w: 22, h: 30, rects: R };
}

/** Building blocks stacked three high, a letter on each, 16 × 24. */
function blocksArt(): Art {
  const R: Rect[] = [];
  const LETTERS = {
    A: [".x.", "x.x", "xxx", "x.x", "x.x"],
    B: ["xx.", "x.x", "xx.", "x.x", "xx."],
    C: [".xx", "x..", "x..", "x..", ".xx"],
  };
  const block = (x: number, y: number, hi: Paint, mid: Paint, lo: Paint, letter: keyof typeof LETTERS) => {
    R.push([x + 1, y, 7, 1, hi], [x, y + 1, 7, 1, hi], [x + 7, y + 1, 1, 7, lo], [x, y + 2, 7, 6, mid]);
    R.push([x, y + 2, 7, 1, lo], [x, y + 7, 7, 1, lo], [x, y + 2, 1, 6, lo], [x + 6, y + 2, 1, 6, lo]);
    R.push(...gk({ x: "paper" }, LETTERS[letter], x + 2, y + 2));
  };
  block(0, 16, "red-hi", "red", "red-lo", "A");
  block(8, 16, "sea", "sea", "sea-lo", "B");
  block(4, 8, "bird", "bird", "bird-lo", "C");
  // A ball balanced on top.
  disc(R, 8, 4, 3.5, "leaf");
  R.push([6, 2, 2, 1, "leaf-hi"], [5, 3, 1, 2, "leaf-hi"], [5, 4, 7, 1, "paper"], [10, 6, 2, 1, "leaf-lo"], [9, 7, 2, 1, "leaf-lo"]);
  return { w: 16, h: 24, rects: R };
}

// ── Woodshop ─────────────────────────────────────────────────────────────

/** A joiner's bench: a leg vice, a plank being planed with its shavings
 *  curling off, a mallet, timber on the shelf beneath, 46 × 36. */
function workbenchArt(): Art {
  const R: Rect[] = [];
  // On top: a plank, the plane on it, shavings, the mallet, a bench dog.
  R.push([10, 10, 22, 1, "wood-hi"], [10, 11, 22, 1, "wood"]);
  R.push(...g(["......ww..", "...wWWdd..", ".nMMMMMMn.", "+MMMMMMMM=", "=========="], 22, 5));
  R.push(...g(["ww..", "w.w.", ".ww.", "..w.", ".ww."], 17, 5), ...g([".w", "w.", "ww"], 14, 7));
  R.push(...g(["DDDD.", "DdDd.", "DDDD.", ".w...", ".w...", ".w..."], 36, 5).map(([x, y, w, h, p]) => [x, y + 0, w, h, p] as Rect));
  R.push([40, 10, 2, 2, "wood-lo"]);
  // The top, thick, its end grain showing at each end.
  R.push([0, 12, 46, 1, "wood-hi"], [0, 13, 46, 3, "wood"], [0, 16, 46, 1, "wood-deep"]);
  for (let x = 3; x < 44; x += 5 + (x % 3)) R.push([x, 14, 2, 1, "wood-lo"]);
  R.push([0, 13, 1, 3, "wood-lo"], [45, 13, 1, 3, "wood-lo"]);
  // The legs, a stretcher and the shelf of timber.
  for (const x of [3, 39]) R.push([x, 17, 4, 17, "wood"], [x, 17, 1, 17, "wood-hi"], [x + 3, 17, 1, 17, "wood-deep"]);
  R.push([7, 17, 32, 2, "wood-lo"], [7, 19, 32, 1, "wood-deep"]);
  R.push([7, 26, 32, 1, "wood-hi"], [7, 27, 32, 2, "wood"], [7, 29, 32, 1, "wood-deep"]);
  R.push([9, 23, 26, 1, "wood-hi"], [9, 24, 26, 2, "wood-lo"], [12, 21, 20, 1, "wood-hi"], [12, 22, 20, 1, "wood"]);
  R.push([34, 21, 1, 2, "wood-deep"], [35, 23, 1, 3, "wood-deep"]);
  R.push([2, 34, 6, 2, "wood-deep"], [38, 34, 6, 2, "wood-deep"]);
  // The leg vice: a wooden chop with a steel screw and a tommy bar.
  R.push([0, 12, 3, 20, "wood"], [0, 12, 1, 20, "wood-hi"], [2, 12, 1, 20, "wood-lo"], [0, 31, 3, 1, "wood-deep"]);
  R.push([0, 18, 4, 2, "metal-lo"], [0, 18, 3, 1, "metal"], [1, 15, 1, 8, "metal-hi"], [1, 15, 1, 1, "metal"], [1, 22, 1, 1, "metal"]);
  // Shavings on the floor.
  R.push(...g([".ww......w.", "w..w...w.w", ".ww.....ww"], 14, 33), ...g(["w.w", ".w."], 30, 34));
  return { w: 46, h: 36, rects: R };
}

/** The wall of tools over the bench: a saw, a hammer, a rack of chisels,
 *  a square, a brace and a coil of cord on a board of pegs, 40 × 30. */
const TOOLS: Art = (() => {
  const R: Rect[] = [];
  R.push([0, 0, 40, 30, "wood-deep"], [1, 1, 38, 28, "wood-lo"]);
  for (const y of [8, 16, 23]) R.push([1, y, 38, 1, "case-seam"]);
  for (let i = 0; i < 9; i++) R.push([2 + Math.floor(scatter(i, 3) * 35), 2 + Math.floor(scatter(i, 7) * 25), 1, 1, "wood-deep"]);
  // A handsaw.
  R.push(...g(["++++++++++wW.", "+MMMMMMMMMwWd", "+MMMMMMMMMw.W", ".=MMMMMMMMwWW", "..=MMMMMMMWd.", "...=======.."], 2, 3));
  for (let x = 3; x < 12; x += 2) R.push([x + 1, 8, 1, 1, "metal-lo"]);
  // A claw hammer.
  R.push(...g(["=+MM", "=.MM"], 17, 2), [19, 4, 1, 10, "wood-hi"], [20, 4, 1, 10, "wood"], [19, 13, 2, 1, "wood-lo"]);
  // Chisels on a rack.
  R.push([23, 6, 13, 2, "wood"], [23, 6, 13, 1, "wood-hi"]);
  for (const [i, x] of [24, 27, 30, 33].entries()) {
    R.push([x, 2, 2, 4, "wood-hi"], [x + 1, 2, 1, 4, "wood"], [x, 8, 2, 1, "brass"], [x, 9, 1, 4 + i, "metal-hi"], [x + 1, 9, 1, 4 + i, "metal"]);
  }
  // A square, a brace and a coil of cord.
  R.push([3, 12, 2, 13, "wood"], [3, 12, 1, 13, "wood-hi"], [5, 22, 9, 2, "metal-hi"], [5, 23, 9, 1, "metal"]);
  R.push(...g(["..wWW..", "...M...", "...M...", "MMMM...", "M..M...", "M..MMMM", "M.....M", "M.....M", "MMMM..M", "...M...", "...=..."], 17, 15));
  R.push(...gk({ c: "rug-fringe", C: "rug-2" }, [".cCCc.", "cC..Cc", "C....C", "cC..Cc", ".cCCc.", "...C..", "...c.."], 30, 16));
  for (const [x, y] of [
    [9, 2],
    [19, 1],
    [4, 11],
    [20, 14],
    [33, 15],
  ])
    R.push([x, y, 1, 1, "brass"]);
  return { w: 40, h: 30, rects: R };
})();

/** A sawhorse with a board being sawn across it, sawdust falling, 30 × 26. */
function sawhorseArt(): Art {
  const R: Rect[] = [];
  // The far legs, then the near ones, splayed under the beam.
  line(R, 6, 12, 2, 25, "wood-lo", 2);
  line(R, 23, 12, 27, 25, "wood-lo", 2);
  line(R, 8, 12, 5, 25, "wood", 2);
  line(R, 21, 12, 24, 25, "wood", 2);
  R.push([4, 19, 4, 1, "wood-deep"], [22, 19, 4, 1, "wood-deep"]);
  R.push([2, 9, 26, 1, "wood-hi"], [2, 10, 26, 2, "wood"], [2, 12, 26, 1, "wood-deep"]);
  // The board, sawn part way through near its end.
  R.push([0, 6, 30, 1, "wood-hi"], [0, 7, 30, 1, "wood"], [0, 8, 30, 1, "wood-lo"]);
  R.push([0, 6, 1, 3, "wood-lo"], [29, 6, 1, 3, "wood-lo"], [11, 7, 3, 1, "wood-lo"]);
  // The saw in the cut.
  R.push(...g([".....wWW", "....wW.W", "...MwWWd", "..MMM...", ".MMM....", "MMM....."], 22, 0));
  R.push([21, 6, 2, 1, "metal-lo"], [21, 7, 1, 2, "ink"]);
  // Sawdust falling, and a heap of it on the floor.
  for (const [x, y] of [
    [22, 10],
    [21, 13],
    [22, 16],
    [21, 19],
    [23, 21],
  ])
    R.push([x, y, 1, 1, "wood-hi"]);
  R.push(...g(["...ww...", ".wwWWww.", "wWWWWWWd"], 18, 23));
  return { w: 30, h: 26, rects: R };
}

/** A red tool chest on castors, an oilcan on top, 16 × 32. */
function toolchestArt(): Art {
  const R: Rect[] = [];
  const RED = { r: "red-hi", R: "red", Z: "red-lo" };
  R.push(...g(["......9.", ".....!9?", "..!!99?.", "..!999?.", ".!9999?."], 2, 0));
  R.push([5, 0, 1, 1, "brass"]);
  R.push(...gk(RED, [".rrrrrrrrrrrrr.", "rRRRRRRRRRRRRRZ", "ZZZZZZZZZZZZZZZ"], 0, 5));
  R.push([6, 4, 4, 1, "metal-lo"]);
  R.push([1, 8, 14, 20, "red"], [1, 8, 1, 20, "red-hi"], [14, 8, 1, 20, "red-lo"]);
  for (const [y, h] of [
    [9, 3],
    [13, 3],
    [17, 4],
    [22, 5],
  ]) {
    R.push([2, y, 12, h, "red"], [2, y + h - 1, 12, 1, "red-lo"], [2, y, 12, 1, "red-hi"]);
    R.push([5, y + 1, 6, 1, "metal-hi"], [5, y + 1 + (h > 3 ? 1 : 0), 6, 1, h > 3 ? "metal" : "metal-hi"]);
  }
  R.push([15, 9, 1, 6, "metal-lo"], [14, 9, 1, 1, "metal"], [14, 14, 1, 1, "metal"]);
  R.push([1, 27, 14, 1, "red-lo"], [1, 28, 14, 1, "metal-lo"]);
  for (const x of [2, 11]) R.push([x, 29, 3, 1, "metal"], ...g([".K.", "KMK", ".K."], x, 29).slice(1));
  return { w: 16, h: 32, rects: R };
}

// ── Sauna ────────────────────────────────────────────────────────────────

/** Two tiers of slatted benches with a backrest on the wall, a towel on
 *  the upper one and a birch whisk on the lower, 52 × 44. */
function benchesArt(): Art {
  const R: Rect[] = [];
  // The backrest: two rails on brackets.
  for (const x of [3, 25, 47]) R.push([x, 2, 2, 15, "wood-lo"], [x, 2, 1, 15, "wood"]);
  for (const y of [3, 8]) R.push([0, y, 52, 1, "wood-hi"], [0, y + 1, 52, 2, "wood"], [0, y + 3, 52, 1, "wood-deep"]);
  // The upper bench: its slats seen from above, its edge, and the boards
  // under it down to the lower bench.
  R.push([0, 17, 52, 1, "wood-lo"], [0, 18, 52, 1, "wood-hi"], [0, 19, 52, 1, "wood-deep"], [0, 20, 52, 1, "wood-hi"]);
  R.push([0, 21, 52, 2, "wood"], [0, 23, 52, 1, "wood-deep"]);
  for (let x = 0, i = 0; x < 52; i++) {
    const w = 5 + Math.floor(scatter(i, 1) * 3);
    R.push([x, 24, 1, 8, "wood-deep"], [x + 1, 24, w - 1, 8, i % 2 ? "wood" : "wood-lo"]);
    if (scatter(i, 2) > 0.45) R.push([x + 2 + Math.floor(scatter(i, 3) * (w - 3)), 25 + Math.floor(scatter(i, 4) * 5), 1, 1, "wood-deep"]);
    x += w;
  }
  // The lower bench, on legs.
  R.push([0, 31, 52, 1, "wood-hi"], [0, 32, 52, 1, "wood-deep"], [0, 33, 52, 1, "wood-hi"], [0, 34, 52, 2, "wood"]);
  R.push([0, 36, 52, 1, "wood-deep"]);
  R.push([0, 37, 52, 7, "case-shadow"]);
  for (const x of [2, 24, 46]) R.push([x, 37, 4, 7, "wood"], [x, 37, 1, 7, "wood-hi"], [x + 3, 37, 1, 7, "wood-deep"]);
  // A towel folded on the upper bench.
  R.push([6, 13, 11, 1, "chair-hi"], [5, 14, 13, 3, "chair"], [5, 14, 1, 3, "chair-hi"], [17, 14, 1, 3, "chair-lo"]);
  R.push([5, 15, 13, 1, "paper"], [5, 17, 13, 1, "chair-lo"], [6, 18, 1, 4, "chair"], [6, 21, 1, 1, "chair-lo"]);
  // A whisk of birch twigs on the lower bench.
  R.push(...g(["....gGg.g....", "..gGjGGjGg...", ".gGjGjGGjGgdd", "gjGGjjGjGdddd", ".jj.jGj.dd..."], 34, 27));
  R.push([46, 30, 2, 1, "rug-2"]);
  return { w: 52, h: 44, rects: R };
}

/** The sauna stove: stones heaped in a cage over a firebox with a little
 *  window, 22 × 42. The fire flickers (STOVE_FLAMES) and steam rises off
 *  the stones. */
function heaterArt(): Art {
  const R: Rect[] = [];
  // The stones, heaped; each a pebble lit from the top left.
  const stones: [number, number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 6);
    stones.push([2.4 + (i % 6) * 3 + (row % 2) * 1.4 + scatter(i, 5) * 0.6, 4 + row * 3 + scatter(i, 6), 1.8 + scatter(i, 7) * 0.5]);
  }
  for (const [i, [cx, cy, r]] of stones.entries()) {
    const shade = ["stone", "stone-lo", "stone", "stone-hi"][Math.floor(scatter(i, 8) * 4)];
    disc(R, cx, cy, r, shade === "stone-hi" ? "stone" : shade);
    R.push([Math.round(cx - r / 2), Math.round(cy - r / 2), 1, 1, "stone-hi"]);
    R.push([Math.round(cx + r / 2), Math.round(cy + r / 2), 1, 1, "stone-deep"]);
  }
  // The cage round them.
  for (let x = 1; x < 22; x += 4) R.push([x, 6, 1, 8, "metal-lo"]);
  R.push([0, 13, 22, 1, "metal-hi"], [0, 14, 22, 1, "metal"], [0, 15, 22, 1, "soot"]);
  // The firebox: a door with a window onto the fire, an ash drawer.
  R.push([1, 16, 20, 21, "metal-lo"], [1, 16, 1, 21, "metal"], [20, 16, 1, 21, "soot"]);
  R.push([4, 18, 14, 13, "soot"], [5, 19, 12, 11, "metal-lo"], [5, 19, 12, 1, "metal"]);
  R.push([7, 21, 8, 6, "soot"], [7, 25, 8, 2, "ember"]);
  R.push([16, 23, 3, 2, "metal-hi"], [18, 22, 1, 4, "wood"]);
  R.push([4, 32, 14, 4, "soot"], [5, 33, 12, 2, "metal-lo"], [9, 33, 4, 1, "metal-hi"]);
  R.push([0, 37, 22, 1, "metal"], [0, 38, 22, 1, "soot"]);
  R.push([2, 39, 3, 3, "soot"], [17, 39, 3, 3, "soot"], [2, 39, 1, 3, "metal-lo"], [17, 39, 1, 3, "metal-lo"]);
  return { w: 22, h: 42, rects: R };
}
/** The fire behind the stove's window, in two flickers. */
const STOVE_FLAMES = [g(["..r..r..", ".rf.rFr.", "rfFfFFfr", "fFFFFFFf"], 7, 21), g(["r....r..", "fr.rfr.r", "fFrfFfrf", "FFFfFFFF"], 7, 21)];
/** The stove's flue, from its top to the ceiling, `h` long, 4 wide. */
function flueArt(h: number): Art {
  return {
    w: 4,
    h,
    rects: [
      [0, 0, 4, h, "metal-lo"],
      [1, 0, 1, h, "metal"],
      [3, 0, 1, h, "soot"],
      [0, 0, 4, 2, "metal"],
      [0, Math.round(h * 0.45), 4, 2, "metal"],
      [0, Math.round(h * 0.45) + 2, 4, 1, "soot"],
    ],
  };
}

/** A wooden bucket with brass hoops and a ladle in it, 12 × 22. */
function bucketArt(): Art {
  const R: Rect[] = [];
  line(R, 11, 0, 6, 11, "wood-hi");
  line(R, 11, 1, 7, 10, "wood-lo");
  R.push([10, 0, 2, 1, "wood-deep"]);
  R.push([0, 11, 12, 1, "wood-hi"], [1, 12, 10, 1, "sea"], [2, 12, 3, 1, "sea-lo"], [6, 12, 1, 1, "wood-lo"]);
  for (let y = 12; y < 22; y++) {
    const inset = y > 18 ? 1 : 0;
    R.push([inset, y, 12 - 2 * inset, 1, "wood"]);
    for (let x = 2; x < 11; x += 3) R.push([x, y, 1, 1, "wood-lo"]);
    R.push([inset, y, 1, 1, "wood-hi"], [11 - inset, y, 1, 1, "wood-deep"]);
  }
  R.push([1, 12, 10, 1, "sea"], [2, 12, 3, 1, "sea-lo"], [7, 12, 1, 1, "wood-lo"]);
  for (const y of [14, 19]) R.push([0, y, 12, 1, "brass"], [0, y, 3, 1, "brass-hi"], [10, y, 2, 1, "brass-lo"]);
  R.push([1, 21, 10, 1, "wood-deep"]);
  return { w: 12, h: 22, rects: R };
}

// ── Drawn in the room ────────────────────────────────────────────────────

const ART = {
  range: RANGE,
  dresser: dresserArt(),
  table: tableArt(),
  wardrobe: wardrobeArt(),
  bed: bedArt(),
  nightstand: nightstandArt(),
  piano: pianoArt(),
  harp: harpArt(),
  cello: celloArt(),
  palm: PALM,
  wicker: WICKER,
  birdcage: birdcageArt(),
  ferns: FERNS,
  darts: dartsArt(),
  billiards: billiardsArt(),
  chess: chessArt(),
  easel: easelArt(),
  paints: paintsArt(),
  bust: BUST,
  bath: bathArt(),
  washstand: washstandArt(),
  towels: towelsArt(),
  sideboard: sideboardArt(),
  dining: diningArt(),
  cabinet: cabinetArt(),
  cot: cotArt(),
  toybox: toyboxArt(),
  blocks: blocksArt(),
  workbench: workbenchArt(),
  sawhorse: sawhorseArt(),
  toolchest: toolchestArt(),
  benches: benchesArt(),
  heater: heaterArt(),
  bucket: bucketArt(),
} satisfies Record<RoomPiece, Art>;
const WINDOW_24 = archWindow(24);
const WINDOW_18 = archWindow(18);

/** Each piece's own art, for tests and previews. */
export const ROOM_PIECE_ART: Readonly<Record<RoomPiece, Art>> = ART;

/**
 * One piece of an added room's furniture, standing on `floorLine` with its
 * left edge at `x`, and whatever it brings for the wall and ceiling.
 */
export function RoomPieceView({
  kind,
  x,
  floorLine,
  ceiling,
  scale: s,
}: {
  kind: RoomPiece;
  x: number;
  floorLine: number;
  ceiling: number;
  scale: number;
}) {
  const at = (dx: number, dy: number) => ({ left: (x + dx) * s, top: (floorLine + dy) * s });
  const a = ART[kind];
  const stand = (extra?: React.ReactNode) => (
    <Stand art={a} x={x} floorLine={floorLine} scale={s}>
      {extra}
    </Stand>
  );
  switch (kind) {
    case "range":
      return (
        <>
          {stand(RANGE_FLAMES.map((f, i) => <Rects key={i} className={`room-frame-${i ? "b" : "a"}`} rects={f} />))}
          <Glow x={x + 24} y={floorLine - 15} r={16} scale={s} className="room-glow-fire" />
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[0] }}
            scale={s}
            className="room-abs room-steam"
            style={at(29, -a.h + 32)}
          />
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[1] }}
            scale={s}
            className="room-abs room-steam room-steam-late"
            style={at(7, -a.h + 36)}
          />
        </>
      );
    case "table":
      return (
        <>
          {stand()}
          <Pendant x={x + 18} ceiling={ceiling} scale={s} />
        </>
      );
    case "bed":
      return (
        <>
          <Sprite art={SAMPLER} scale={s} className="room-abs room-art-dim" style={at(18, -66)} />
          {stand()}
        </>
      );
    case "nightstand":
      return (
        <>
          {stand()}
          <Glow x={x + 6} y={floorLine - a.h + 7} r={22} scale={s} />
        </>
      );
    case "piano":
      return (
        <>
          {stand()}
          {[4, 37].map((dx) => (
            <Stand key={dx} art={CANDLESTICK} x={x + dx} floorLine={floorLine - a.h} scale={s} />
          ))}
          <Glow x={x + 22} y={floorLine - a.h - 6} r={24} scale={s} />
        </>
      );
    case "wicker":
      return (
        <>
          <Sprite art={WINDOW_24} scale={s} className="room-abs" style={at(0, -96)} />
          <div className="room-sunbeam" aria-hidden="true" style={{ ...at(2, -40), width: 30 * s, height: 40 * s }} />
          {stand()}
        </>
      );
    case "ferns":
      return (
        <>
          <Sprite art={WINDOW_18} scale={s} className="room-abs" style={at(0, -96)} />
          {stand()}
        </>
      );
    case "birdcage":
      return stand(BIRD.map((f, i) => <Rects key={i} className={`room-hop-${i ? "b" : "a"}`} rects={f} />));
    case "darts":
      return <Sprite art={a} scale={s} className="room-abs" style={at(0, -86)} />;
    case "billiards":
      return (
        <>
          {stand()}
          {/* Hung so the shades are a hand's breadth over the cloth. */}
          <Sprite
            art={billiardLamp(floorLine - a.h - 18 - ceiling)}
            scale={s}
            className="room-abs"
            style={{ left: (x + 10) * s, top: ceiling * s }}
          />
          <Glow x={x + 20} y={floorLine - a.h - 18} r={22} scale={s} />
          <Glow x={x + 40} y={floorLine - a.h - 18} r={22} scale={s} />
        </>
      );
    case "bath":
      return (
        <>
          {stand()}
          {[
            [13, 1],
            [24, -2],
            [36, 2],
          ].map(([dx, dy], i) => (
            <Sprite
              key={i}
              art={{ w: 3, h: 3, rects: BATH_BUBBLES[i % 2] }}
              scale={s}
              className={`room-abs room-bubble room-bubble-${i}`}
              style={at(dx, -a.h + dy - 3)}
            />
          ))}
        </>
      );
    case "washstand":
      return (
        <>
          <Sprite art={MIRROR} scale={s} className="room-abs" style={at(3, -a.h - 34)} />
          {stand()}
        </>
      );
    case "dining": {
      // Hung so its drops are a hand's breadth over the candles.
      const lamp = chandelierArt(floorLine - a.h - 12 - ceiling);
      return (
        <>
          {stand()}
          <Sprite art={lamp} scale={s} className="room-abs" style={{ left: (x + 14) * s, top: ceiling * s }} />
          <Glow x={x + 25} y={ceiling + lamp.h - 10} r={30} scale={s} />
        </>
      );
    }
    case "cot": {
      const m = mobileArt(floorLine - a.h - 8 - ceiling);
      return (
        <>
          {stand()}
          <Sprite art={m.art} scale={s} className="room-abs room-mobile" style={{ left: (x + 8) * s, top: ceiling * s }}>
            {m.frames.map((f, i) => (
              <Rects key={i} className={`room-swing-${i}`} rects={f} />
            ))}
          </Sprite>
        </>
      );
    }
    case "workbench":
      return (
        <>
          <Sprite art={TOOLS} scale={s} className="room-abs" style={at(3, -a.h - 40)} />
          {stand()}
        </>
      );
    case "heater":
      return (
        <>
          <Sprite
            art={flueArt(floorLine - a.h + 8 - ceiling)}
            scale={s}
            className="room-abs"
            style={{ left: (x + 9) * s, top: ceiling * s }}
          />
          {stand(STOVE_FLAMES.map((f, i) => <Rects key={i} className={`room-frame-${i ? "b" : "a"}`} rects={f} />))}
          <Glow x={x + 11} y={floorLine - 18} r={20} scale={s} className="room-glow-fire" />
          {[
            [4, 2, ""],
            [10, 0, " room-steam-late"],
            [16, 3, ""],
          ].map(([dx, dy, late], i) => (
            <Sprite
              key={i}
              art={{ w: 2, h: 3, rects: STEAM[i % 2] }}
              scale={s}
              className={`room-abs room-steam${late}`}
              style={at(Number(dx), -a.h + Number(dy) - 2)}
            />
          ))}
        </>
      );
    default:
      return stand();
  }
}

/** A room's furniture side by side, standing on a floor line 100 dots
 *  down, for the Decorate panel; the wall and floor behind it are the
 *  caller's. */
export function RoomPreview({ pieces, scale = 1 }: { pieces: readonly RoomPiece[]; scale?: number }) {
  const gap = 4;
  const h = 100;
  const starts = pieces.map((_, i) => pieces.slice(0, i).reduce((x, k) => x + ART[k].w + gap, 0));
  const w = Math.max(0, pieces.reduce((x, k) => x + ART[k].w, 0) + gap * (pieces.length - 1));
  return (
    <div className="relative shrink-0" style={{ width: w * scale, height: h * scale }}>
      {pieces.map((kind, i) => (
        <RoomPieceView key={kind} kind={kind} x={starts[i]} floorLine={h} ceiling={0} scale={scale} />
      ))}
    </div>
  );
}
