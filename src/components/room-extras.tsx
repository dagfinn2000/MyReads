/**
 * The furniture the reader can add from Decorate's catalogue (lib/room.ts:
 * EXTRAS): a sofa, a rocking chair, an aquarium, a dog asleep in its
 * basket, a suit of armour, a sea chest, a coat stand, a telescope, a
 * rocking horse, a curio cabinet and a spinning wheel. Drawn like the rest
 * of the room (room-art.tsx), each stands on the floor with its left edge
 * at `x`. The fish swim, bubbles rise and the dog's ear twitches now and
 * then; at night the aquarium glows.
 */
import { Glow, Rects, STEAM, Sprite, Stand, grid, type Art, type Paint, type Rect } from "@/components/room-art";
import { PIECE_WIDTH, type Extra } from "@/lib/room";

/** Paints the catalogue adds to room-art's text-grid key. */
const KEY: Record<string, Paint> = {
  æ: "dog-hi",
  ø: "dog",
  å: "dog-lo",
  Æ: "dog-deep",
  "[": "marble-hi",
  "]": "marble",
  "|": "marble-lo",
  "/": "wicker-hi",
  ":": "wicker",
  ";": "wicker-lo",
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

/** A polygon, every dot whose middle is inside. */
function poly(R: Rect[], pts: readonly (readonly [number, number])[], paint: Paint) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    pts.forEach(([x0, y0], k) => {
      const [x1, y1] = pts[(k + 1) % pts.length];
      if ((y0 <= cy && y1 > cy) || (y1 <= cy && y0 > cy)) xs.push(x0 + ((cy - y0) * (x1 - x0)) / (y1 - y0));
    });
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]);
      const b = Math.round(xs[k + 1]);
      if (b > a) R.push([a, y, b - a, 1, paint]);
    }
  }
}

/** A filled ellipse. */
function ellipse(R: Rect[], cx: number, cy: number, rx: number, ry: number, paint: Paint) {
  for (let y = Math.floor(cy - ry); y < cy + ry; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) >= 1) continue;
    const hw = rx * Math.sqrt(1 - dy * dy);
    const a = Math.round(cx - hw);
    const b = Math.round(cx + hw);
    if (b > a) R.push([a, y, b - a, 1, paint]);
  }
}

/** A drawing made dot by dot, each dot over the one before, then joined
 *  into rectangles a row at a time: for shapes worked out by sum. */
function sheet(w: number, h: number) {
  const dots: (Paint | null)[][] = Array.from({ length: h }, () => new Array<Paint | null>(w).fill(null));
  const on = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;
  const set = (x: number, y: number, paint: Paint | null) => {
    if (on(x, y)) dots[y][x] = paint;
  };
  return {
    w,
    h,
    get: (x: number, y: number) => (on(x, y) ? dots[y][x] : null),
    set,
    /** Rectangles drawn by the helpers above, dot by dot. */
    put(rects: readonly Rect[]) {
      for (const [x, y, rw, rh, paint] of rects) {
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, paint);
      }
    },
    art(): Art {
      const rects: Rect[] = [];
      dots.forEach((row, y) => {
        for (let x = 0; x < w; ) {
          let end = x + 1;
          while (end < w && row[end] === row[x]) end++;
          const paint = row[x];
          if (paint) rects.push([x, y, end - x, 1, paint]);
          x = end;
        }
      });
      return { w, h, rects };
    },
  };
}
type Sheet = ReturnType<typeof sheet>;

/** A Chesterfield, 46 × 25: a deep-buttoned back, rolled arms, three seat
 *  cushions and a scatter cushion in the corner. In the room's fabric. */
function sofaArt(): Art {
  const R: Rect[] = [];
  // Back.
  R.push([5, 0, 36, 1, "chair-deep"], [4, 1, 1, 13, "chair-deep"], [41, 1, 1, 13, "chair-deep"]);
  R.push([5, 1, 36, 13, "chair"], [5, 1, 36, 1, "chair-hi"], [5, 2, 1, 11, "chair-hi"], [40, 2, 1, 11, "chair-lo"]);
  for (let row = 0; row < 3; row++) {
    for (let x = row % 2 ? 11 : 8; x < 39; x += 6) {
      const y = 4 + row * 3;
      R.push([x, y, 1, 1, "chair-deep"], [x - 1, y - 1, 1, 1, "chair-lo"], [x + 1, y + 1, 1, 1, "chair-hi"]);
    }
  }
  // Rolled arms.
  for (const side of [0, 39]) {
    R.push([side + 1, 7, 5, 1, "chair-deep"], [side, 8, 1, 14, "chair-deep"], [side + 6, 8, 1, 14, "chair-deep"]);
    R.push([side + 1, 8, 5, 14, "chair"], [side + 1, 8, 5, 1, "chair-hi"], [side + 1, 9, 1, 13, "chair-hi"]);
    R.push([side + 5, 9, 1, 13, "chair-lo"]);
    R.push([side + 2, 9, 3, 1, "chair-lo"], [side + 2, 10, 1, 1, "chair-lo"], [side + 4, 10, 1, 1, "chair-lo"]);
    R.push([side + 2, 11, 3, 1, "chair-lo"]);
    for (let y = 14; y < 21; y += 3) R.push([side + 3, y, 1, 1, "chair-deep"]);
  }
  // A scatter cushion in the left corner, then the seat cushions.
  R.push(...g([".UUUUU.", "UUUUUUV", "UUUUUUV", "UUUUUVV", ".VVVVV."], 7, 8));
  R.push([7, 13, 32, 1, "chair-hi"], [7, 14, 32, 2, "chair"], [7, 16, 32, 1, "chair-lo"]);
  R.push([17, 13, 1, 4, "chair-deep"], [28, 13, 1, 4, "chair-deep"]);
  // Front rail, piped, and turned feet.
  R.push([7, 17, 32, 1, "chair-deep"], [7, 18, 32, 4, "chair"], [7, 18, 32, 1, "chair-lo"]);
  for (let x = 10; x < 38; x += 5) R.push([x, 20, 1, 1, "chair-deep"]);
  R.push([0, 22, 46, 1, "chair-deep"]);
  R.push([2, 23, 3, 1, "wood"], [41, 23, 3, 1, "wood"], [2, 24, 2, 1, "wood-lo"], [42, 24, 2, 1, "wood-lo"]);
  return { w: 46, h: 25, rects: R };
}

/** A ladder-back rocking chair seen from a little to one side, 22 × 34,
 *  with a cushion on its seat and a blanket folded over its arm. */
function rockerArt(): Art {
  const R: Rect[] = [];
  const rocker = (x: number) => 31 - Math.round(((x - 10.5) / 10.5) ** 2 * 3);
  // The far rocker and legs, behind.
  for (let x = 3; x < 22; x++) R.push([x, rocker(x) - 1, 1, 1, "wood-lo"]);
  R.push([9, 22, 1, 8, "wood-lo"], [20, 22, 1, 8, "wood-lo"]);
  // The back: a far post, slats, and the near post in front.
  line(R, 10, 1, 10, 20, "wood-lo", 2);
  for (const y of [4, 8, 12, 16]) R.push([4, y, 6, 2, "wood"], [4, y, 6, 1, "wood-hi"], [4, y + 1, 6, 1, "wood-lo"]);
  line(R, 2, 1, 4, 22, "wood", 2);
  R.push([2, 0, 10, 1, "wood-hi"], [3, 1, 7, 1, "wood-lo"]);
  // Seat, with the cushion on it.
  R.push([4, 19, 17, 1, "wood"], [4, 20, 17, 1, "wood-hi"], [4, 21, 17, 1, "wood-lo"]);
  R.push(...g(["..UUUUUUUUUUU.", ".UUUUUUUUUUUUV", ".VVVVVVVVVVVV."], 5, 16));
  // The near arm, and a blanket folded over it.
  R.push([4, 11, 16, 1, "wood-hi"], [4, 12, 16, 1, "wood"], [18, 13, 2, 6, "wood"], [19, 13, 1, 6, "wood-lo"]);
  R.push(...g(["5656565", "6565656", "5656565", "77777.7", ".7.7.7."], 11, 12));
  // Near legs, a stretcher, and the near rocker.
  R.push([5, 22, 2, 9, "wood"], [6, 22, 1, 9, "wood-lo"], [17, 22, 2, 9, "wood"], [18, 22, 1, 9, "wood-lo"]);
  R.push([7, 27, 10, 1, "wood-lo"]);
  for (let x = 0; x < 22; x++) R.push([x, rocker(x), 1, 1, "wood"], [x, rocker(x) + 1, 1, 1, "wood-lo"]);
  R.push([0, rocker(0) - 1, 1, 1, "wood-hi"], [21, rocker(21) - 1, 1, 1, "wood-hi"]);
  return { w: 22, h: 34, rects: R };
}

/** A fish tank on a cabinet, 30 × 46: weed and a little castle on the
 *  gravel, the glass catching the light. The fish are separate (FISH). */
function aquariumArt(): Art {
  const R: Rect[] = [];
  // Lid, glass and water.
  R.push([0, 0, 30, 2, "metal-lo"], [1, 0, 28, 1, "metal"], [0, 2, 30, 1, "metal"]);
  R.push([0, 3, 30, 22, "glass-lo"], [1, 3, 28, 21, "sea"], [1, 3, 28, 1, "glass-hi"], [1, 4, 28, 1, "sea-lo"]);
  R.push([0, 3, 1, 22, "metal-lo"], [29, 3, 1, 22, "metal-lo"]);
  // Gravel.
  R.push([1, 21, 28, 3, "pot"], [1, 21, 28, 1, "pot-hi"]);
  for (let x = 2; x < 28; x += 3) R.push([x, 22 + (x % 2), 1, 1, "pot-lo"]);
  // Weed, left; a castle, right.
  R.push(
    ...g(["..g...", ".jG.g.", ".jG.G.", "..GjG.", ".gG.j.", ".Gj.G.", "..G.Gj", ".jG.G.", "..GjG.", "...G.."], 2, 11),
  );
  R.push(...g(["s.s.s", "SSSSS", "SKStS", "SSSSt", "SKKSt", "SKKSt"], 20, 15));
  R.push([22, 13, 1, 2, "stone-lo"], [22, 12, 2, 1, "flower"]);
  // The glass catching the light.
  line(R, 24, 5, 27, 9, "glass-hi");
  line(R, 22, 5, 23, 6, "glass-hi");
  R.push([0, 24, 30, 1, "metal-lo"]);
  // Cabinet: a top, two doors, a plinth.
  R.push([0, 25, 30, 1, "wood-hi"], [0, 26, 30, 1, "wood"], [1, 27, 28, 1, "wood-deep"]);
  R.push([1, 28, 28, 15, "wood"], [1, 28, 1, 15, "wood-hi"], [28, 28, 1, 15, "wood-lo"], [14, 28, 2, 15, "wood-lo"]);
  for (const x of [3, 17]) {
    R.push([x, 30, 10, 11, "wood-lo"], [x + 1, 31, 8, 9, "wood"], [x + 1, 31, 8, 1, "wood-hi"]);
  }
  R.push([12, 35, 1, 2, "brass"], [17, 35, 1, 2, "brass"]);
  R.push([0, 43, 30, 1, "wood-deep"], [1, 44, 3, 2, "wood-lo"], [26, 44, 3, 2, "wood-lo"]);
  return { w: 30, h: 46, rects: R };
}

/** The fish, each facing right; they swim to and fro (room-swim). */
const FISH = [g(["?.!9.", "??9K9", "?.99."]), g(["b.B.", "nBKB", "n.B."])];
/** Bubbles rising from the castle. */
const BUBBLE = g(["a"]);

/** A spaniel asleep in a wicker basket, 24 × 15, curled up with its chin
 *  on the rim. Its left ear is separate (EARS), so it can twitch. */
function dogArt(): Art {
  const R: Rect[] = [];
  // The basket's raised back.
  R.push([0, 4, 2, 6, "wicker"], [0, 4, 2, 1, "wicker-hi"], [22, 4, 2, 6, "wicker"], [22, 4, 2, 1, "wicker-hi"]);
  // Curled up: the back with a white patch, the tail round the front.
  ellipse(R, 8.5, 6.5, 8, 4.5, "dog");
  R.push([4, 2, 9, 1, "dog-hi"], [2, 3, 3, 1, "dog-hi"], [12, 3, 3, 1, "dog-hi"]);
  R.push([6, 3, 4, 2, "dog-white"], [7, 5, 2, 1, "dog-white"]);
  R.push([2, 8, 6, 2, "dog-lo"], [3, 7, 3, 1, "dog-lo"], [8, 9, 2, 1, "dog-white"]);
  // The head, facing out, and a paw beside it; then the right ear.
  R.push(...g([".åøøøøå.", "åøøøøøøå", "øøøuuøøø", "øøKuuKøø", "øøuuuuøø", ".øuKKuø.", "..uuuu.."], 15, 3));
  R.push([11, 9, 3, 1, "dog-white"], [11, 9, 1, 1, "dog-lo"]);
  R.push(...g(["ÆÆ.", "ÆÆÆ", "ÆÆÆ", "ÆÆÆ", ".ÆÆ", ".ÆÆ"], 21, 4));
  // Blanket, rim and the woven front.
  R.push([2, 9, 9, 1, "rug"], [4, 9, 2, 1, "rug-2"]);
  R.push([0, 10, 24, 1, "wicker-hi"], [0, 11, 24, 1, "wicker"]);
  for (let y = 12; y < 15; y++) {
    const inset = y - 12;
    R.push([inset, y, 24 - 2 * inset, 1, "wicker"]);
    for (let x = inset + (y % 2) * 2; x < 24 - inset; x += 4) R.push([x, y, 2, 1, "wicker-lo"]);
  }
  return { w: 24, h: 15, rects: R };
}

/** The dog's left ear: hanging down, and lifted a moment now and then. */
const EARS = [g([".ÆÆ", "ÆÆÆ", "ÆÆÆ", "ÆÆÆ", "ÆÆ.", "ÆÆ."], 14, 4), g(["ÆÆ.", "ÆÆÆ", ".ÆÆ"], 13, 3)];

/** A suit of armour on a stand, 20 × 60, plumed, with a halberd. */
function armourArt(): Art {
  const R: Rect[] = [];
  const cx = 8;
  /** A plate `hw` either side of the middle, lit from the left. */
  const plate = (y: number, h: number, hw: number) => {
    R.push([cx - hw, y, 2 * hw + 1, h, "metal"]);
    R.push([cx - hw, y, 1, h, "metal-hi"], [cx + hw, y, 1, h, "metal-lo"]);
  };
  // Halberd: spike, axe head and hook, and the shaft.
  R.push([16, 4, 2, 54, "wood"], [17, 4, 1, 54, "wood-lo"]);
  R.push(...g([".+.", ".M.", ".M=", "MM="], 15, 0));
  R.push(...g(["M...", "MM+.", "MMM+", "MMM+", "MMM+", "MMM+", "MM+.", "M..."], 16, 5));
  R.push([14, 8, 2, 1, "metal"], [14, 9, 1, 1, "metal-lo"]);
  // Plume, in the room's fabric.
  R.push(...g(["..55.", ".5556", "55566", "5566.", ".56..", "..6.."], 6, 0));
  // Helmet with its visor.
  R.push([cx - 2, 6, 5, 1, "metal-hi"]);
  plate(7, 8, 3);
  R.push([cx, 6, 1, 9, "metal-hi"]);
  R.push(
    [cx - 2, 10, 5, 1, "ink"],
    [cx - 2, 11, 5, 1, "metal-lo"],
    [cx - 1, 13, 1, 1, "ink"],
    [cx + 1, 13, 1, 1, "ink"],
  );
  R.push([cx - 2, 15, 5, 2, "metal-lo"]);
  // Pauldrons over the breastplate.
  plate(17, 15, 4);
  R.push([cx - 1, 18, 1, 11, "metal-hi"], [cx + 2, 20, 1, 9, "metal-lo"]);
  for (const side of [-1, 1]) {
    const x = side < 0 ? cx - 7 : cx + 4;
    R.push([x, 16, 4, 6, "metal"], [x, 16, 4, 1, "metal-hi"], [x, 18, 4, 1, "metal-lo"], [x, 20, 4, 1, "metal-lo"]);
    R.push([side < 0 ? x : x + 3, 17, 1, 5, side < 0 ? "metal-hi" : "metal-lo"]);
  }
  plate(28, 4, 3);
  // Arms down to the gauntlets; the right hand holds the halberd.
  R.push([cx - 7, 22, 2, 12, "metal"], [cx - 7, 22, 1, 12, "metal-hi"], [cx - 8, 26, 3, 2, "metal-lo"]);
  R.push([cx + 5, 22, 2, 12, "metal"], [cx + 6, 22, 1, 12, "metal-lo"], [cx + 5, 26, 3, 2, "metal-lo"]);
  R.push(...g(["MM=", "M+=", "+M=", ".=."], cx - 8, 33));
  R.push(...g(["MMMMM", "M+MM=", "=====", "..=.."], cx + 5, 33));
  // Belt.
  R.push([cx - 4, 32, 9, 2, "brass-lo"], [cx - 4, 32, 9, 1, "brass"], [cx - 1, 32, 3, 2, "brass-hi"]);
  // Tassets, then the legs.
  plate(34, 5, 4);
  R.push([cx - 4, 36, 9, 1, "metal-lo"], [cx, 34, 1, 5, "metal-lo"]);
  for (const x of [cx - 3, cx + 1]) {
    R.push([x, 39, 3, 5, "metal"], [x, 39, 1, 5, "metal-hi"], [x + 2, 39, 1, 5, "metal-lo"]);
    R.push([x - 1, 44, 4, 2, "metal"], [x - 1, 44, 4, 1, "metal-hi"], [x + 1, 45, 1, 1, "metal-lo"]);
    R.push([x, 46, 3, 7, "metal"], [x, 46, 1, 7, "metal-hi"], [x + 2, 46, 1, 7, "metal-lo"]);
  }
  R.push(...g(["MMM...MMM", "+MMM.MMM="], cx - 5, 53));
  // Stand.
  R.push([1, 55, 15, 1, "wood-hi"], [1, 56, 15, 3, "wood"], [1, 58, 15, 1, "wood-lo"], [0, 59, 20, 1, "wood-deep"]);
  return { w: 20, h: 60, rects: R };
}

/** A sea chest, 26 × 18: a domed lid, brass bands and a lock. */
function chestArt(): Art {
  const R: Rect[] = [];
  R.push([3, 0, 20, 1, "wood-hi"], [1, 1, 24, 1, "wood-hi"], [0, 2, 26, 4, "wood"], [0, 2, 26, 1, "wood-hi"]);
  R.push([0, 4, 26, 1, "wood-lo"], [0, 6, 26, 1, "wood-deep"]);
  R.push([0, 7, 26, 10, "wood"], [0, 7, 1, 10, "wood-hi"], [25, 7, 1, 10, "wood-lo"]);
  for (const y of [10, 13]) R.push([1, y, 24, 1, "wood-lo"]);
  // Bands and corners.
  for (const x of [4, 20]) {
    R.push([x, x === 4 ? 1 : 1, 2, 16, "brass"], [x + 1, 1, 1, 16, "brass-lo"], [x, 1, 2, 1, "brass-hi"]);
  }
  R.push([0, 15, 3, 2, "brass-lo"], [23, 15, 3, 2, "brass-lo"], [0, 7, 2, 2, "brass-lo"], [24, 7, 2, 2, "brass-lo"]);
  // Lock plate and keyhole.
  R.push(...g(["+MMM=", "MMKM=", "MMKM=", "=MMM=", ".===."], 11, 5));
  // Plinth.
  R.push([0, 17, 26, 1, "wood-deep"]);
  return { w: 26, h: 18, rects: R };
}

/** A coat stand, 14 × 62: a long coat, a bowler hat, a striped scarf, and
 *  an umbrella leaning at its foot. */
function coatstandArt(): Art {
  const R: Rect[] = [];
  // Pole, knob and hooks.
  R.push([6, 4, 2, 52, "wood"], [7, 4, 1, 52, "wood-lo"]);
  R.push(...g([".ww.", "wWWd", "WWWd", ".dd."], 5, 0));
  R.push(...g(["n......n", ".n....n.", "..nBBn.."], 3, 5));
  // Tripod feet.
  line(R, 6, 54, 1, 61, "wood", 2);
  line(R, 7, 54, 12, 61, "wood-lo", 2);
  R.push([6, 54, 2, 7, "wood-lo"]);
  // The coat on the left hook: collar and lapels, sleeves, a belt.
  R.push(
    ...g(
      [
        "..ZZZ..",
        ".NZRZR.",
        "NRZRZRZ",
        "NRRZRRZ",
        "NZRZBRZ",
        "NZRRRZZ",
        "NZRRBRZ",
        "NZRRRZZ",
        "NZRRBRZ",
        "NZRRRZZ",
        "NZRRBRZ",
        "NZRRRZZ",
        "ZZZnZZZ",
        "NZRRRZZ",
        "NZRRRZZ",
        "NNRRRZZ",
        "NZRRRRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "NRRRZRZ",
        "ZZZZZZZ",
      ],
      0,
      7,
    ),
  );
  // A bowler on the top right hook, and the scarf beneath it.
  R.push(...g(["..KKK.", ".KKKKK", ".nnnnn", "KKKKKKK"], 7, 2));
  R.push(...g(["55", "66", "55", "77", "55", "66", "55", "77", "55", "66", "55", "8.8"], 10, 7));
  // Umbrella, furled, its crook at the top.
  R.push(
    ...g(
      [".dd.", "d..d", "...d", "...K", "..KK", ".KKK", ".KK=", ".KKK", ".KK=", ".KKK", "..KK", "..K.", "..K.", "..=."],
      9,
      46,
    ),
  );
  return { w: 14, h: 62, rects: R };
}

/** A brass telescope on a wooden tripod, 24 × 46, looking up at the sky. */
function telescopeArt(): Art {
  const R: Rect[] = [];
  // Tripod: two legs out front, one behind, and the mount.
  line(R, 12, 24, 12, 45, "wood-lo", 2);
  line(R, 11, 23, 2, 45, "wood", 2);
  line(R, 13, 23, 21, 45, "wood", 2);
  R.push([2, 45, 3, 1, "wood-deep"], [20, 45, 3, 1, "wood-deep"]);
  // The tube, row by row from its lens down to the eyepiece.
  for (let y = 6; y <= 29; y++) {
    const x = 3 + (y - 6) * 0.72;
    const r = y < 10 ? 3 : 2;
    const a = Math.round(x - r);
    const b = Math.round(x + r);
    const band = y === 14 || y === 22;
    R.push([a, y, b - a, 1, band ? "brass-lo" : "brass"], [a, y, 1, 1, "brass-hi"], [b - 1, y, 1, 1, "brass-lo"]);
  }
  R.push([0, 6, 7, 1, "glass-hi"], [0, 5, 7, 1, "brass-lo"]);
  R.push([18, 30, 3, 2, "metal-lo"], [19, 32, 2, 1, "ink"]);
  // The mount, holding it.
  R.push([9, 19, 6, 4, "brass-lo"], [10, 19, 4, 1, "brass-hi"], [11, 20, 2, 2, "brass"]);
  // A finder scope alongside.
  line(R, 12, 14, 16, 20, "metal");
  R.push([12, 13, 1, 1, "glass-hi"], [15, 20, 2, 1, "metal-lo"]);
  return { w: 24, h: 46, rects: R };
}

/** A dapple-grey rocking horse, 30 × 30: a red saddle and bridle, a dark
 *  mane and tail, a brass handle, on bow rockers. */
const HORSE: Art = (() => {
  const R: Rect[] = [];
  const rocker = (x: number) => 28 - Math.round(((x - 14.5) / 14.5) ** 2 * 4);
  // Far legs, behind.
  line(R, 12, 17, 8, rocker(8) - 1, "marble-lo", 2);
  line(R, 20, 17, 23, rocker(23) - 1, "marble-lo", 2);
  // Tail.
  line(R, 26, 12, 28, 16, "ink", 2);
  line(R, 28, 16, 27, 22, "ink", 2);
  // Body, chest and rump.
  ellipse(R, 17, 14.5, 9, 3.8, "marble");
  ellipse(R, 10.5, 13.5, 3.5, 3.8, "marble");
  ellipse(R, 23, 13.5, 3.8, 3.6, "marble");
  R.push([11, 11, 14, 1, "marble-hi"], [10, 17, 14, 1, "marble-lo"], [22, 10, 2, 1, "marble-hi"]);
  // Neck and head.
  poly(
    R,
    [
      [8, 3],
      [11, 2],
      [15, 8],
      [15, 12],
      [8, 13],
      [6, 9],
    ],
    "marble",
  );
  poly(
    R,
    [
      [9, 1],
      [6, 2],
      [1, 6],
      [0, 8],
      [1, 10],
      [4, 10],
      [8, 7],
      [11, 4],
    ],
    "marble",
  );
  R.push([5, 2, 3, 1, "marble-hi"], [3, 4, 2, 1, "marble-hi"], [1, 9, 3, 1, "marble-lo"]);
  // Ears, forelock and mane.
  R.push([8, 0, 1, 2, "marble"], [10, 0, 1, 2, "marble-lo"]);
  line(R, 10, 1, 16, 10, "ink", 2);
  R.push([7, 2, 2, 2, "ink"], [13, 7, 1, 2, "ink"], [11, 4, 1, 2, "ink"]);
  // Eye, nostril, bridle and the handle.
  R.push([5, 4, 1, 1, "ink"], [1, 7, 1, 1, "marble-lo"]);
  line(R, 3, 9, 8, 3, "rug-2");
  R.push([2, 6, 1, 4, "rug-2"], [3, 9, 1, 1, "brass"]);
  R.push([9, 5, 3, 1, "brass"], [9, 5, 1, 1, "brass-hi"]);
  // Saddle and stirrup.
  poly(
    R,
    [
      [13, 10],
      [20, 10],
      [21, 12],
      [19, 15],
      [14, 15],
      [12, 12],
    ],
    "rug",
  );
  R.push([13, 10, 7, 1, "rug-3"], [14, 14, 5, 1, "rug-2"]);
  R.push([17, 15, 1, 3, "metal-lo"], [16, 18, 3, 1, "brass"]);
  // Dapples.
  for (const [x, y] of [
    [9, 12],
    [12, 15],
    [20, 13],
    [24, 14],
    [17, 16],
    [22, 11],
    [7, 9],
    [26, 13],
  ]) {
    R.push([x, y, 1, 1, "marble-lo"]);
  }
  // Near legs, hooves, and the rocker.
  line(R, 10, 16, 5, rocker(5) - 1, "marble", 2);
  line(R, 23, 16, 26, rocker(26) - 1, "marble", 2);
  for (const x of [4, 7, 22, 26]) R.push([x, rocker(x) - 1, 3, 1, "wood-deep"]);
  for (let x = 0; x < 30; x++) R.push([x, rocker(x), 1, 1, "wood"], [x, rocker(x) + 1, 1, 1, "wood-lo"]);
  R.push([0, rocker(0) - 1, 1, 1, "wood-hi"], [29, rocker(29) - 1, 1, 1, "wood-hi"]);
  return { w: 30, h: 30, rects: R };
})();

/** A glazed curio cabinet on short legs, 26 × 62: an ammonite and a
 *  butterfly, a ship in a bottle and a pocket watch, a crystal and a shell,
 *  old books and a magnifying glass. */
function curiosArt(): Art {
  const R: Rect[] = [];
  // Crown, carcass and the dark inside.
  R.push([0, 0, 26, 1, "wood-hi"], [1, 1, 24, 1, "wood"], [0, 2, 26, 2, "wood-lo"], [1, 4, 24, 1, "wood-deep"]);
  R.push([1, 5, 24, 50, "wood"], [1, 5, 1, 50, "wood-hi"], [24, 5, 1, 50, "wood-lo"]);
  R.push([3, 7, 20, 41, "wood-deep"]);
  // Shelves.
  for (const y of [17, 28, 39]) R.push([3, y, 20, 1, "wood"], [3, y + 1, 20, 1, "wood-lo"]);
  // Top shelf: an ammonite, a framed butterfly.
  R.push(...g([".YyyY.", "Yy..yY", "y.YY.y", "y.Yy.Y", "Yy...Y", ".YYYY."], 4, 11));
  R.push(...g(["nnnnnnn", "ny~.~yn", "n~~i~~n", "ny~.~yn", "ny-.-yn", "nnnnnnn"], 13, 10));
  // A ship in a bottle; a pocket watch.
  R.push(...g(["..aaaaaaa..", ".a..y.y..a.", "aa.yyyyy..aKK", "a.dWWWWWd.a..", ".aaaaaaaaa..."], 4, 23));
  R.push(...g(["..n..", ".bBn.", "bByBn", "BKyKn", "BByBn", ".nnn."], 17, 22));
  // A crystal; a shell.
  R.push(...g(["..a..", ".aa~.", ".a~~.", "aa~~-", "a~~--", "~~---"], 5, 33));
  R.push(...g(["..i..", ".iyi.", "iyiyi", "yiyiy", ".YYY."], 14, 34));
  // Books, a magnifying glass.
  R.push(...g(["33333333", "yyyyyyYy", "44444444", "11111111"], 4, 44));
  R.push(...g([".nnn.", "na.vn", "nvvvn", ".nnn.", "...W.", "....W"], 16, 42));
  // Glass doors: frames, a reflection, small brass knobs.
  R.push([2, 6, 22, 1, "wood-lo"], [2, 48, 22, 1, "wood-lo"], [2, 6, 1, 43, "wood-lo"], [23, 6, 1, 43, "wood-lo"]);
  R.push([12, 6, 2, 43, "wood"], [13, 6, 1, 43, "wood-lo"]);
  line(R, 4, 8, 8, 14, "glass-hi");
  line(R, 15, 8, 19, 14, "glass-hi");
  R.push([11, 26, 1, 2, "brass"], [14, 26, 1, 2, "brass"]);
  // A drawer, the base and legs.
  R.push([2, 49, 22, 5, "wood-lo"], [3, 50, 20, 3, "wood"], [3, 50, 20, 1, "wood-hi"], [12, 51, 2, 1, "brass"]);
  R.push([0, 55, 26, 1, "wood-hi"], [0, 56, 26, 2, "wood-lo"]);
  R.push([1, 58, 3, 4, "wood"], [22, 58, 3, 4, "wood"], [3, 58, 1, 4, "wood-lo"], [24, 58, 1, 4, "wood-lo"]);
  return { w: 26, h: 62, rects: R };
}

/** A spinning wheel, 26 × 36, with wool on its distaff. */
function spinningArt(): Art {
  const R: Rect[] = [];
  const cx = 15;
  const cy = 13;
  // The wheel: rim, spokes, hub.
  for (let a = 0; a < 360; a += 3) {
    const t = (a * Math.PI) / 180;
    R.push([Math.round(cx + 10 * Math.cos(t)), Math.round(cy + 10 * Math.sin(t)), 1, 1, a > 180 ? "wood-hi" : "wood"]);
    R.push([Math.round(cx + 9 * Math.cos(t)), Math.round(cy + 9 * Math.sin(t)), 1, 1, "wood-lo"]);
  }
  for (let k = 0; k < 8; k++) {
    const t = (k * Math.PI) / 4 + Math.PI / 8;
    line(R, cx, cy, Math.round(cx + 8 * Math.cos(t)), Math.round(cy + 8 * Math.sin(t)), "wood-lo");
  }
  R.push([cx - 1, cy - 1, 3, 3, "brass"], [cx, cy, 1, 1, "brass-hi"]);
  // Uprights from the axle down to the bench.
  R.push([cx - 1, cy + 2, 1, 12, "wood"], [cx + 1, cy + 2, 1, 12, "wood-lo"]);
  // The bench, sloping, and three splayed legs.
  line(R, 1, 27, 25, 24, "wood-hi", 1);
  line(R, 1, 28, 25, 25, "wood", 1);
  line(R, 2, 29, 25, 26, "wood-lo", 1);
  line(R, 4, 29, 2, 35, "wood", 2);
  line(R, 22, 26, 24, 35, "wood", 2);
  line(R, 13, 28, 13, 35, "wood-lo", 2);
  // Treadle and footman.
  R.push([6, 33, 9, 1, "wood"], [6, 34, 9, 1, "wood-lo"]);
  line(R, cx + 1, cy + 1, 12, 33, "wood-deep");
  // Maidens, flyer and a bobbin of yarn on the left.
  R.push([3, 19, 1, 9, "wood"], [8, 19, 1, 8, "wood"], [2, 18, 3, 1, "wood-hi"], [7, 18, 3, 1, "wood-hi"]);
  R.push([4, 21, 4, 3, "rug"], [4, 21, 4, 1, "rug-2"], [3, 22, 6, 1, "wood-lo"]);
  // Distaff with a cloud of wool.
  line(R, 6, 18, 4, 6, "wood-lo");
  R.push(...g([".yyy.", "yyyyy", "yyyyY", "yyYyY", ".yyY.", "..Y.."], 2, 1));
  // The thread from the wool to the flyer.
  line(R, 5, 7, 7, 21, "paper-lo");
  return { w: 26, h: 36, rects: R };
}

/** A slouchy bean bag in the room's fabric, 22 × 17, still dented where
 *  someone last sat in it. */
function beanbagArt(): Art {
  const R = g([
    "..............XXXX....",
    "............XXcccCXX..",
    "...........XccCCCCCxX.",
    "..........XcCCCCCCCCxX",
    ".....XXXXXcCCCCCCCCCxX",
    "...XXcccccxxCCCCCCCCxX",
    "..XccCCCCCxxxCCCCCCCxX",
    ".XcCCCCCCCCxxCCCCCCxxX",
    ".XcCCCCCCCCCxxCCCCCxxX",
    "XcCCCCCCCCCCCxCCCCCxxX",
    "XcCCCCCCCCCCCCCCCCCxxX",
    "XcCCCCCCCCCCCCCCCCCxxX",
    "XcCCCCCCCCCCCCCCCCxxxX",
    "XxCCCCCCCCCCCCCCCCxxxX",
    "XxxCCCCCCCCCCCCCCxxxxX",
    ".XxxxxxxxxxxxxxxxxxxX.",
    "..XXXXXXXXXXXXXXXXXX..",
  ]);
  // Creases where it slumps on the floor, a seam over the back, a sheen.
  R.push([4, 13, 1, 1, "chair-lo"], [5, 12, 1, 1, "chair-lo"], [9, 14, 2, 1, "chair-lo"], [11, 13, 1, 1, "chair-lo"]);
  R.push([15, 13, 1, 1, "chair-lo"], [16, 12, 1, 1, "chair-lo"]);
  R.push([17, 2, 1, 2, "chair-lo"], [18, 4, 1, 3, "chair-lo"]);
  R.push([14, 2, 2, 1, "chair-hi"], [13, 3, 2, 1, "chair-hi"], [3, 7, 1, 2, "chair-hi"]);
  return { w: 22, h: 17, rects: R };
}

/** Paints for the macaw: red, its yellow and blue wings. */
const MACAW_KEY: Record<string, Paint> = {
  ...KEY,
  "[": "marble",
  "]": "marble-lo",
  "|": "paper-lo",
  é: "parrot-hi",
  è: "parrot",
  ê: "parrot-lo",
  ",": "bird",
  "'": "bird-lo",
  â: "parrot-blue",
  à: "parrot-blue-lo",
};
/** The macaw, facing left: its head, its body and folded wings, its long
 *  tail and its feet. */
const MACAW_HEAD = [
  "....èèèè..",
  "..éèèèèèê.",
  ".[[yyyèèèê",
  "[]]yKyèèèê",
  "[]]]yyèèèê",
  "]]]KKèèèèê",
  "]]|KKéèèèê",
  ".]|.éèèèèê",
  "..|.éèèèèê",
];
const MACAW_BODY = [
  "...éèèèè,ê",
  "...éèèè,,ê",
  "..éèèè,,'ê",
  "..éèè,,',ê",
  "..éèè,',ââ",
  "..èèè'ââàâ",
  "..èèââââàâ",
  "...èâââàà.",
  "...êâàâàà.",
  "...êêàâà..",
];
const MACAW_TAIL = [
  ".....èâàà.",
  ".....èèâà.",
  ".....èèâà.",
  "......èèâ.",
  "......èâà.",
  "......èèâ.",
  "......èèâ.",
  ".......èâ.",
  ".......èâ.",
  ".......èà.",
  ".......ââ.",
  ".......â..",
];
const MACAW_FEET = ["..=..=....", "..=..=...."];

/** The macaw at `ox` along its perch, its head ducked by (`dx`, `dy`); the
 *  bit of perch in front of its tail comes with it. */
function macaw(ox: number, dx: number, dy: number): Rect[] {
  const m = (rows: readonly string[], x: number, y: number) => grid(rows, x, y, MACAW_KEY);
  return [
    ...m(MACAW_TAIL, ox, 19),
    ...g(["wwwww", "ddddd"], ox + 5, 19),
    ...m(MACAW_BODY, ox, 8),
    ...m(MACAW_HEAD, ox + dx, dy),
    ...m(MACAW_FEET, ox, 18),
  ];
}
/** Up on its perch; sidled along to its seed cup to peer in. */
const MACAW = [macaw(6, 0, 0), macaw(3, -1, 2)];

/** A macaw's T-perch, 16 × 64: a turned pole on a weighted foot, a seed
 *  cup at one end of the bar. The macaw itself is MACAW. */
function parrotArt(): Art {
  const R: Rect[] = [];
  // The pole with brass collars, on a turned foot.
  R.push([7, 21, 2, 35, "wood"], [7, 21, 1, 35, "wood-hi"], [8, 21, 1, 35, "wood-lo"]);
  R.push([6, 21, 4, 1, "brass-hi"], [6, 22, 4, 1, "brass-lo"], [6, 38, 4, 1, "brass-hi"], [6, 39, 4, 1, "brass-lo"]);
  R.push(
    ...g(
      [
        "......bBBn......",
        "......wWWd......",
        ".....wWWWWd.....",
        "...wwWWWWWWdd...",
        ".wwWWWWWWWWWWdd.",
        "wWWWWWWWWWWWWWWd",
        "DddddddddddddddD",
        ".DDDDDDDDDDDDDD.",
      ],
      0,
      56,
    ),
  );
  // The bar, knobbed at the ends.
  R.push([1, 19, 14, 1, "wood-hi"], [1, 20, 14, 1, "wood-lo"]);
  R.push(...g([".w", "wW", "dD", ".D"], 0, 18), ...g(["w.", "Wd", "DD", "D."], 14, 18));
  // The seed cup.
  R.push(...g(["..:/:..", ".:/:;:.", "bBBBBBn", ".BBBBn.", "..nnn.."], 0, 14));
  return { w: 16, h: 64, rects: R };
}

/** One monstera leaf, from its stalk at (bx, by), pointing `angle` degrees
 *  (0 is right, -90 up), `len` long and `wide` either side of its rib.
 *  `cuts` are where slits run in from each side (0 to 1, base to tip) and
 *  `holes` where there are windows by the rib, [along, side]. Behind
 *  (`back`), it's in shadow. */
function monsteraLeaf(
  S: Sheet,
  [bx, by, angle, len, wide, cuts, holes, back]: MonsteraLeaf,
) {
  const c = Math.cos((angle * Math.PI) / 180);
  const s = Math.sin((angle * Math.PI) / 180);
  // The side of the rib that faces up, to the light.
  const litSide = c > 0 ? 0 : 1;
  const shape = new Set<number>();
  const paints = new Map<number, Paint>();
  for (let y = 0; y < S.h; y++) {
    for (let x = 0; x < S.w; x++) {
      const px = x + 0.5 - bx;
      const py = y + 0.5 - by;
      const u = px * c + py * s;
      const v = -px * s + py * c;
      const t = u / len;
      if (t < -0.1 || t > 1) continue;
      const av = Math.abs(v);
      // Heart-shaped: two lobes either side of the stalk at its base.
      const hw = t < 0 ? (av < 1.2 ? 0 : wide * 0.55) : wide * Math.pow(Math.sin((Math.PI * (t + 0.14)) / 1.14), 0.6);
      if (av > hw) continue;
      const key = y * 1000 + x;
      shape.add(key);
      const side = v < 0 ? 0 : 1;
      // Slits follow the veins: out from the rib and on towards the tip.
      const vein = (u - 0.5 * av) / len;
      if (av > 0.38 * hw && cuts[side].some((k) => Math.abs(vein - k) * len < 0.5)) continue;
      if (holes.some(([k, sd]) => sd === side && Math.abs(t - k) * len < 0.7 && Math.abs(av - 0.3 * hw) < 0.7)) continue;
      const lit = side === litSide;
      paints.set(key, av < 0.55 ? (back ? "leaf" : "leaf-hi") : lit ? (back ? "leaf-lo" : "leaf") : back ? "pine" : "leaf-lo");
    }
  }
  // Outlined round its edge (not along the slits).
  for (const [key, paint] of paints) {
    const x = key % 1000;
    const y = (key - x) / 1000;
    const edge = !shape.has(key + 1000) || !shape.has(key + 1) || !shape.has(key - 1000) || !shape.has(key - 1);
    S.set(x, y, edge ? "pine-lo" : paint);
  }
}
type MonsteraLeaf = [
  bx: number,
  by: number,
  angle: number,
  len: number,
  wide: number,
  cuts: readonly [readonly number[], readonly number[]],
  holes: readonly (readonly [number, number])[],
  back?: boolean,
];

/** A monstera in a woven basket, 24 × 54: big leaves, each its own size
 *  and turn, slit and holed like the real thing. */
function monsteraArt(): Art {
  const S = sheet(24, 54);
  const leaves: MonsteraLeaf[] = [
    [13, 18, -80, 16, 7, [[0.3, 0.48, 0.66, 0.82], [0.28, 0.46, 0.64, 0.8]], [[0.4, 0], [0.55, 1]], true],
    [8, 36, 152, 9, 4.5, [[0.4, 0.7], [0.35, 0.65]], [], true],
    [10, 26, -146, 12.5, 6, [[0.3, 0.5, 0.7, 0.86], [0.34, 0.56, 0.78]], [[0.42, 1], [0.6, 0]]],
    [15, 24, -32, 11, 5.5, [[0.34, 0.56, 0.78], [0.3, 0.52, 0.76]], [[0.48, 0]]],
    [15, 35, 36, 10, 5, [[0.36, 0.62, 0.84], [0.42, 0.72]], [[0.5, 1]]],
    [12, 36, -100, 11, 5.5, [[0.3, 0.52, 0.74], [0.36, 0.58, 0.8]], [[0.46, 0], [0.52, 1]]],
  ];
  // Stalks from the basket to each leaf, behind them.
  const stalks: Rect[] = [];
  for (const [bx, by] of leaves) {
    const sx = Math.round(12 + (bx - 12) * 0.3);
    const mx = Math.round((sx + bx) / 2 + (bx - 12) * 0.2);
    const my = Math.round((41 + by) / 2);
    line(stalks, sx, 41, mx, my, "leaf-lo");
    line(stalks, mx, my, Math.round(bx), Math.round(by), "leaf-lo");
  }
  S.put(stalks);
  for (const leaf of leaves) monsteraLeaf(S, leaf);
  // The basket.
  S.put([
    [3, 41, 18, 1, "wicker-hi"],
    [3, 42, 18, 1, "wicker-lo"],
  ]);
  for (let y = 43; y < 53; y++) {
    const inset = 4 + Math.floor((y - 43) / 4);
    S.put([[inset, y, 24 - 2 * inset, 1, "wicker"]]);
    for (let x = inset + ((y >> 1) % 2) * 2; x < 24 - inset; x += 4) S.put([[x, y, 2, 1, "wicker-lo"]]);
    S.put([
      [inset, y, 1, 1, "wicker-hi"],
      [23 - inset, y, 1, 1, "wicker-lo"],
    ]);
  }
  S.put([[6, 53, 12, 1, "wicker-lo"]]);
  return S.art();
}

/** A cheval glass, 18 × 62: an oval looking glass that tilts between two
 *  turned posts, on splayed feet. */
function mirrorArt(): Art {
  const S = sheet(18, 62);
  const cx = 9;
  const cy = 28;
  // Posts, finials and feet.
  S.put([[1, 8, 2, 50, "wood"], [1, 8, 1, 50, "wood-hi"], [15, 8, 2, 50, "wood"], [16, 8, 1, 50, "wood-lo"]]);
  S.put(g([".bn.", "bBBn", ".nn."], 0, 5));
  S.put(g([".bn.", "bBBn", ".nn."], 14, 5));
  S.put([[0, 8, 4, 1, "wood-deep"], [14, 8, 4, 1, "wood-deep"]]);
  S.put([[3, 50, 12, 1, "wood-hi"], [3, 51, 12, 1, "wood-lo"]]);
  S.put(g(["..wWd...", ".wWWWd..", "wWd.dWd.", "DD...DD."], -2, 57));
  S.put(g(["..wWd...", ".wWWWd..", "wWd.dWd.", "DD...DD."], 12, 57));
  // The oval: a moulded frame round the glass.
  const rx = 6.5;
  const ry = 17;
  for (let y = 0; y < S.h; y++) {
    for (let x = 0; x < S.w; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const e = nx * nx + ny * ny;
      if (e > 1) continue;
      const gx = (x + 0.5 - cx) / (rx - 1.7);
      const gy = (y + 0.5 - cy) / (ry - 1.7);
      const light = -(nx + ny * 0.6);
      if (gx * gx + gy * gy > 1) {
        S.set(x, y, e > 0.86 ? "wood-deep" : light > 0.3 ? "wood-hi" : light < -0.3 ? "wood-lo" : "wood");
      } else {
        const d = gx + gy * 0.5;
        S.set(x, y, d < -0.55 ? "glass-hi" : d > 0.6 ? "glass-lo" : "glass");
      }
    }
  }
  // A shine across the glass, and the floor it catches at its foot.
  const shine: Rect[] = [];
  line(shine, 5, 22, 9, 15, "glass-shine");
  line(shine, 6, 26, 11, 17, "glass-shine");
  line(shine, 9, 38, 12, 33, "glass-shine");
  S.put(shine);
  // Pivots and a little carved crest.
  S.put([[3, 27, 1, 2, "brass"], [14, 27, 1, 2, "brass"], [2, 28, 2, 1, "brass-lo"], [14, 28, 2, 1, "brass-lo"]]);
  S.put(g(["..bn..", ".wWWd.", "wW.dWd"], 6, 9));
  return S.art();
}

/** A cast-iron wood stove, 22 × 84: a fire behind its window (STOVE_FIRE),
 *  an ash door with a spinner vent, a copper kettle on the hob, and its
 *  pipe up the wall into a collar; a basket of birch logs beside it. */
function stoveArt(): Art {
  const R: Rect[] = [];
  // The pipe, banded at its joints and with a damper, into its wall collar.
  R.push(...g(["...+MM=...", ".+MMMMMM=.", "+MM====MM=", "+M======M=", "+M======M=", "+MM====MM=", ".=MMMMMM=.", "...====..."], 3, 1));
  R.push([5, 4, 6, 3, "metal-lo"], [6, 3, 4, 1, "metal"]);
  R.push([6, 8, 4, 48, "metal-lo"], [6, 8, 1, 48, "metal"], [9, 8, 1, 48, "soot"]);
  for (const y of [18, 32, 46]) R.push([5, y, 6, 1, "metal"], [5, y + 1, 6, 1, "soot"]);
  R.push([3, 39, 3, 1, "brass"], [3, 38, 1, 3, "brass-lo"]);
  // Collar, top plate with corner knobs.
  R.push([5, 55, 6, 2, "metal"], [5, 55, 6, 1, "metal-hi"]);
  R.push([0, 57, 16, 1, "metal-hi"], [0, 58, 16, 2, "metal"], [0, 60, 16, 1, "soot"]);
  R.push([0, 56, 1, 1, "brass"], [15, 56, 1, 1, "brass"]);
  // The kettle on the hob.
  R.push(...g(["..nn...", ".9!99..", "!9999?9", "!999?.9", ".????.."], 10, 51));
  // The body: the fire door with its window, the ash door below.
  R.push([1, 61, 14, 17, "metal-lo"], [1, 61, 1, 17, "metal"], [14, 61, 1, 17, "soot"]);
  R.push([3, 62, 10, 11, "soot"], [4, 63, 8, 9, "metal-lo"]);
  R.push([5, 64, 6, 6, "ember"], [6, 64, 4, 1, "soot"]);
  R.push([4, 63, 1, 1, "metal"], [4, 71, 1, 1, "metal"], [12, 66, 2, 1, "brass"], [13, 67, 1, 2, "brass-lo"]);
  R.push([3, 74, 10, 3, "soot"], [4, 75, 8, 1, "metal-lo"], ...g(["nbn"], 7, 75));
  // Plinth and cabriole legs.
  R.push([0, 77, 16, 1, "metal"], [0, 78, 16, 1, "soot"]);
  R.push(...g(["MM=", ".M=", ".M.", "MM."], 1, 79), ...g(["+M=", "+M.", ".M.", ".MM"], 12, 79));
  // A wicker basket of birch logs.
  R.push(...g(["<>..<.", "<<.<<>", "><<>><", ".<><<."], 16, 70));
  R.push([16, 74, 6, 1, "wicker-hi"]);
  for (let y = 75; y < 83; y++) {
    R.push([16, y, 6, 1, "wicker"]);
    for (let x = 16 + ((y >> 1) % 2) * 2; x < 22; x += 4) R.push([x, y, 2, 1, "wicker-lo"]);
  }
  R.push([16, 83, 6, 1, "wicker-lo"], [15, 74, 1, 3, "wicker-lo"], [21, 72, 1, 3, "wicker-lo"]);
  return { w: 22, h: 84, rects: R };
}
/** The fire in the stove's window, in two flickers, over its logs. */
const STOVE_FIRE = [
  g(["..r...", ".rf.r.", ".fFrf.", "rfFFfr", "dWWWWd"], 5, 65),
  g(["....r.", ".r.rf.", ".rfFf.", "rfFFFr", "dWWWWd"], 5, 65),
];

/** An old valve radio, 18 × 41: a cathedral cabinet with a fretwork
 *  grille, its dial lit at night, on a little table with two books on its
 *  shelf. */
function radioArt(): Art {
  const R: Rect[] = [];
  R.push(
    ...g(
      [
        "....wwwwww....",
        "..wwWWWWWWdd..",
        ".wWWddddddWWd.",
        ".wWd:;::;:dWd.",
        "wWd:/:;;:/:dWd",
        "wWd::;WW;::dWd",
        "wWd:;W::W;:dWd",
        "wWd:/W/;W/:dWd",
        "wWd::W::W::dWd",
        "wWd:;W;:W;:dWd",
        "wWd::W::W::dWd",
        "wWdddddddddDWd",
        "wWWWWWWWWWWWWd",
        "wWnlLLLLLLlnWd",
        "wWnLKLLLLLLnWd",
        "wWWWWWWWWWWWWd",
        "wBnWWWWWWWWBnd",
        "DDDDDDDDDDDDDD",
      ],
      2,
      0,
    ),
  );
  // The table: a top, a drawer, a shelf with books, turned legs.
  R.push([0, 18, 18, 1, "wood-hi"], [0, 19, 18, 1, "wood"], [0, 20, 18, 1, "wood-deep"]);
  R.push([1, 21, 16, 4, "wood-lo"], [2, 22, 14, 2, "wood"], [8, 22, 2, 1, "brass"]);
  R.push([1, 21, 2, 20, "wood"], [1, 21, 1, 20, "wood-hi"], [15, 21, 2, 20, "wood"], [16, 21, 1, 20, "wood-lo"]);
  R.push(...g(["33333333.", "444444444", "yyyyyyyY."], 4, 31));
  R.push([3, 34, 12, 1, "wood-hi"], [3, 35, 12, 1, "wood-lo"]);
  R.push([0, 39, 4, 2, "wood-deep"], [14, 39, 4, 2, "wood-deep"]);
  return { w: 18, h: 41, rects: R };
}
/** A note, rising from the radio. */
const NOTE = g([".bn", ".b.", ".b.", "bB.", "BB."]);

/** A brass and walnut tea trolley, 26 × 38: a china teapot and two cups
 *  on top, a cake stand on the shelf below. */
function trolleyArt(): Art {
  const R: Rect[] = [];
  // The teapot, then the cups and saucers.
  R.push(
    ...g(
      [
        "......nBn.....",
        ".....yyyyy....",
        "....YYYYYYY...",
        "y..yyyyyyyyy..",
        "yy.yyiyyyiyyyy",
        ".yyyiiiyiiiy.y",
        "..yyyiyyyiyyyy",
        "...yyyyyyyyyY.",
        "....YyyyyyYY..",
        ".....YYYYYY...",
      ],
      1,
      5,
    ),
  );
  for (const x of [15, 20]) R.push(...g(["yyyy.", "yiyyY", "Yyyy.", "YYYYY"], x, 11));
  // Trays and the brass frame, a handle at the right.
  R.push([0, 15, 26, 1, "wood-hi"], [0, 16, 26, 1, "wood"], [0, 17, 26, 1, "wood-deep"]);
  R.push([0, 29, 26, 1, "wood-hi"], [0, 30, 26, 1, "wood"], [0, 31, 26, 1, "wood-deep"]);
  R.push([1, 18, 1, 15, "brass"], [24, 18, 1, 15, "brass-lo"], [1, 14, 1, 1, "brass-hi"]);
  R.push(...g(["..bBn", ".b..n", ".B..n", ".B..n", ".B..n", ".n..n"], 21, 8));
  // The cake stand.
  R.push(...g([".i.", "yiy"], 10, 18), [11, 20, 1, 8, "brass"], ...g(["..i.y..", "yyyyyyy", ".nnnnn."], 8, 21));
  R.push(...g(["..i..y.i.", ".iyi.yyiy", "YYYYYYYYY", ".nnnnnnn."], 7, 25));
  // Castors.
  for (const x of [0, 22]) R.push(...g(["..n.", ".KK.", "KMMK", ".KK."], x, 32));
  return { w: 26, h: 36, rects: R };
}

/** A dollhouse on a low table, 30 × 50: a little gabled house in the
 *  house's own brick and roof, its front open on four rooms and an attic,
 *  their windows lit at night. */
function dollhouseArt(): Art {
  const R: Rect[] = [];
  // Chimney, roof.
  R.push([21, 3, 3, 8, "outer"], [21, 3, 1, 8, "outer-hi"], [20, 2, 5, 1, "outer-lo"]);
  for (let y = 5; y < 16; y++) {
    const half = Math.min(15, Math.round((y - 4) * 1.32) + 1);
    R.push([15 - half, y, 2 * half, 1, y % 2 ? "roof" : "roof-lo"]);
    R.push([15 - half, y, 2, 1, "roof-hi"], [13 + half, y, 2, 1, "roof-deep"]);
  }
  // The attic, under the roof: a round window.
  for (let y = 9; y < 16; y++) {
    const half = Math.round((y - 4) * 1.32) - 2;
    if (half > 0) R.push([15 - half, y, 2 * half, 1, "wall-2"]);
  }
  R.push(...g([".JJ.", "J..J", "J..J", ".JJ."], 13, 10), [14, 11, 2, 2, "attic"]);
  // The house: walls of brick round four rooms, a floor between them.
  R.push([2, 16, 26, 22, "outer"], [2, 16, 1, 22, "outer-hi"], [27, 16, 1, 22, "outer-lo"]);
  R.push([1, 15, 28, 1, "roof-deep"]);
  const room = (x: number, y: number, paper: Paint) => {
    R.push([x, y, 11, 9, paper], [x, y, 11, 1, "wall-shadow"]);
    R.push([x, y + 9, 11, 1, "wood-hi"]);
    R.push([x + 4, y + 2, 3, 3, "trim"], [x + 5, y + 3, 1, 1, "attic"]);
  };
  room(4, 17, "wall");
  room(15, 17, "wall-2");
  room(4, 27, "tile");
  room(15, 27, "wall");
  // Bedroom: a bed. Nursery: a bookcase. Kitchen: a range. Parlour: a fire and a chair.
  R.push(...g(["w......", "wyUUUUU", "wUUUUUU", "d.....d"], 5, 22));
  R.push(...g(["DDD", "343", "DDD", "434", "DDD"], 23, 21));
  R.push(...g(["kkkk", "kekk", "kkkk"], 5, 33));
  R.push(...g(["SSSS", "SkkS", "SekS"], 16, 33), ...g(["Cc.", "CCc", "x.x"], 22, 33));
  R.push([2, 37, 26, 1, "outer-lo"]);
  // The low table.
  R.push([0, 38, 30, 1, "wood-hi"], [0, 39, 30, 1, "wood"], [0, 40, 30, 1, "wood-deep"]);
  R.push([1, 41, 28, 3, "wood-lo"], [2, 41, 26, 1, "wood-deep"]);
  R.push([1, 41, 3, 9, "wood"], [1, 41, 1, 9, "wood-hi"], [26, 41, 3, 9, "wood"], [28, 41, 1, 9, "wood-lo"]);
  return { w: 30, h: 50, rects: R };
}

const ART = {
  sofa: sofaArt(),
  rocker: rockerArt(),
  aquarium: aquariumArt(),
  dog: dogArt(),
  armour: armourArt(),
  chest: chestArt(),
  coatstand: coatstandArt(),
  telescope: telescopeArt(),
  horse: HORSE,
  curios: curiosArt(),
  spinning: spinningArt(),
  beanbag: beanbagArt(),
  parrot: parrotArt(),
  monstera: monsteraArt(),
  mirror: mirrorArt(),
  stove: stoveArt(),
  radio: radioArt(),
  trolley: trolleyArt(),
  dollhouse: dollhouseArt(),
} satisfies Record<Extra, Art>;

export const EXTRA_ART: Readonly<Record<Extra, Art>> = ART;

/** One of the catalogue's pieces, standing on the floor at `x`. */
export function ExtraView({
  kind,
  x,
  floorLine,
  scale: s,
}: {
  kind: Extra;
  x: number;
  floorLine: number;
  scale: number;
}) {
  const a = ART[kind];
  const top = floorLine - a.h;
  switch (kind) {
    case "aquarium":
      return (
        <>
          <Stand art={a} x={x} floorLine={floorLine} scale={s} />
          <Sprite
            art={{ w: 5, h: 3, rects: FISH[0] }}
            scale={s}
            className="room-abs room-swim"
            style={{ left: (x + 6) * s, top: (top + 8) * s }}
          />
          <Sprite
            art={{ w: 4, h: 3, rects: FISH[1] }}
            scale={s}
            className="room-abs room-swim room-swim-late"
            style={{ left: (x + 10) * s, top: (top + 15) * s }}
          />
          {[0, 1, 2].map((i) => (
            <Sprite
              key={i}
              art={{ w: 1, h: 1, rects: BUBBLE }}
              scale={s}
              className={`room-abs room-bubble room-bubble-${i}`}
              style={{ left: (x + 22 + (i % 2)) * s, top: (top + 12 - 3 * i) * s }}
            />
          ))}
          <Glow x={x + 15} y={top + 13} r={20} scale={s} className="room-glow-sea" />
        </>
      );
    case "dog":
      return (
        <Stand art={a} x={x} floorLine={floorLine} scale={s}>
          <Rects className="room-twitch-a" rects={EARS[0]} />
          <Rects className="room-twitch-b" rects={EARS[1]} />
        </Stand>
      );
    case "parrot":
      return (
        <Stand art={a} x={x} floorLine={floorLine} scale={s}>
          <Rects className="room-hop-a" rects={MACAW[0]} />
          <Rects className="room-hop-b" rects={MACAW[1]} />
        </Stand>
      );
    case "stove":
      return (
        <>
          <Stand art={a} x={x} floorLine={floorLine} scale={s}>
            <Rects className="room-frame-a" rects={STOVE_FIRE[0]} />
            <Rects className="room-frame-b" rects={STOVE_FIRE[1]} />
          </Stand>
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[1] }}
            scale={s}
            className="room-abs room-steam"
            style={{ left: (x + 16) * s, top: (top + 47) * s }}
          />
          <Glow x={x + 8} y={top + 67} r={20} scale={s} className="room-glow-fire" />
        </>
      );
    case "radio":
      return (
        <>
          <Stand art={a} x={x} floorLine={floorLine} scale={s} />
          {[0, 1].map((i) => (
            <Sprite
              key={i}
              art={{ w: 3, h: 5, rects: NOTE }}
              scale={s}
              className={`room-abs room-steam ${i ? "room-steam-late" : ""}`}
              style={{ left: (x + 13 + 3 * i) * s, top: (top - 3 - 2 * i) * s }}
            />
          ))}
          <Glow x={x + 9} y={top + 14} r={9} scale={s} />
        </>
      );
    case "trolley":
      return (
        <>
          <Stand art={a} x={x} floorLine={floorLine} scale={s} />
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[0] }}
            scale={s}
            className="room-abs room-steam"
            style={{ left: (x + 1) * s, top: (top + 4) * s }}
          />
          <Sprite
            art={{ w: 2, h: 3, rects: STEAM[1] }}
            scale={s}
            className="room-abs room-steam room-steam-late"
            style={{ left: (x + 16) * s, top: (top + 7) * s }}
          />
        </>
      );
    case "dollhouse":
      return (
        <>
          <Stand art={a} x={x} floorLine={floorLine} scale={s} />
          <Glow x={x + 15} y={top + 26} r={18} scale={s} />
        </>
      );
    default:
      return <Stand art={a} x={x} floorLine={floorLine} scale={s} />;
  }
}

/** A piece from the catalogue on its own, standing on a floor line at the
 *  bottom, for the Decorate panel. */
export function ExtraPreview({ kind, scale = 1 }: { kind: Extra; scale?: number }) {
  const a = ART[kind];
  return (
    <div className="relative shrink-0" style={{ width: PIECE_WIDTH[kind] * scale, height: a.h * scale }}>
      <ExtraView kind={kind} x={0} floorLine={a.h} scale={scale} />
    </div>
  );
}
