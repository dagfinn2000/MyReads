/**
 * The furniture of the rooms the reader can add to the house (lib/room.ts:
 * ROOMS): a kitchen, a bedroom, a music room, a conservatory, a games room
 * and a studio. Drawn like the rest of the room (room-art.tsx), each piece
 * stands on the floor with its left edge at `x`, and some bring something
 * for the wall above them: tiles and pans over the range, a window behind
 * the conservatory's chair, a lamp over the billiard table.
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
