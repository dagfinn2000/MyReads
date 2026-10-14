/**
 * The pet who follows the avatar about the reading room (lib/pets.ts), as
 * pixel art: trotting along (two frames that swap as it goes, like the
 * avatar's legs) and curled up asleep at the armchair while a book is
 * read. Each is drawn as a text grid of fills facing right; the outline
 * goes round it by itself.
 *
 * The cat and the dog are painted in the house's cat and dog paints, so
 * they wear the coats chosen for them (reading-room.css); the cat's grid
 * marks where a tabby's stripes, a calico's patches and a Siamese's dark
 * points go, which other coats paint over plainly.
 */
import type { Art, Paint, Rect } from "@/components/room-art";
import type { Pet } from "@/lib/pets";

export interface PetArt {
  stand: Art;
  stride: Art;
  curl: Art;
}

type Key = Record<string, Paint>;

const CAT_KEY: Key = {
  O: "cat",
  o: "cat-hi",
  h: "cat-lo",
  u: "cat-white",
  s: "cat-stripe",
  a: "cat-patch",
  b: "cat-patch2",
  n: "cat-point",
  k: "pet-eye",
  p: "pet-nose",
};
const DOG_KEY: Key = { O: "dog", o: "dog-hi", h: "dog-lo", u: "dog-white", k: "pet-eye", n: "pet-eye" };
const RABBIT_KEY: Key = { O: "bun", o: "bun-hi", h: "bun-lo", u: "bun-white", p: "pet-nose", k: "pet-eye", n: "pet-nose" };
const HEDGEHOG_KEY: Key = { m: "hog-lo", O: "hog", o: "hog-hi", u: "hog-face", h: "hog-lo", k: "pet-eye", n: "pet-eye" };
const FOX_KEY: Key = { O: "fox", o: "fox-hi", h: "fox-lo", u: "fox-white", m: "fox-sock", k: "pet-eye", n: "pet-eye" };
const DRAGON_KEY: Key = {
  O: "drg",
  o: "drg-hi",
  h: "drg-lo",
  u: "drg-belly",
  w: "drg-wing",
  W: "drg-wing-lo",
  m: "drg-spike",
  n: "drg-horn",
  p: "drg-horn",
  k: "pet-eye",
};

/** Fills from a text grid, outlined in `line` all round: one dot of
 *  margin each side, so the art is two dots wider and taller than the
 *  grid. Grids of a pet's frames are the same size, so its feet stay on
 *  the floor as they swap. */
function outlined(rows: readonly string[], key: Key, line: Paint): Art {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const h = rows.length + 2;
  const cells = new Map<number, Paint>();
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (key[ch]) cells.set((y + 1) * w + x + 1, key[ch]);
    }),
  );
  const all = new Map(cells);
  for (const i of cells.keys()) {
    for (const j of [i - 1, i + 1, i - w, i + w]) if (!all.has(j)) all.set(j, line);
  }
  const rects: Rect[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; ) {
      const paint = all.get(y * w + x);
      let end = x + 1;
      while (paint && end < w && all.get(y * w + end) === paint) end++;
      if (paint) rects.push([x, y, end - x, 1, paint]);
      x = end;
    }
  }
  return { w, h, rects };
}

const pet = (key: Key, line: Paint, stand: string[], stride: string[], curl: string[]): PetArt => ({
  stand: outlined(stand, key, line),
  stride: outlined(stride, key, line),
  curl: outlined(curl, key, line),
});

const CAT = pet(
  CAT_KEY,
  "cat-deep",
  [
    "..........n..n.",
    ".n........aOsO.",
    "n.........OOkOp",
    "n.........OOOuu",
    ".OsOOsbbsOOOu..",
    ".OsaaOObOOOOu..",
    "..haaOOOOOhu...",
    "..h.h....h.h...",
    "..n.n....n.n...",
  ],
  [
    "..........n..n.",
    "n.........aOsO.",
    "n.........OOkOp",
    ".n........OOOuu",
    ".OsOOsbbsOOOu..",
    ".OsaaOObOOOOu..",
    "..haaOOOOOhu...",
    ".h...h..h...h..",
    "n.....nn.....n.",
  ],
  [
    ".n.n.........",
    "nOnOn..OOsO..",
    "OOOOOOOsOOsO.",
    "OkOkObbOOsOOO",
    "uOOOObbOaaOhO",
    ".uuOhhhhaahOn",
  ],
);

const DOG = pet(
  DOG_KEY,
  "dog-deep",
  [
    "..........OOO...",
    "o........OOOOO..",
    ".O.......hOOkOO.",
    ".O......hhOOOOOn",
    "..OOOOOOhhhOuu..",
    "..OoooooOhhu....",
    "..OOOOOOOOhu....",
    "...hOOOOOOh.....",
    "...h.h...h.h....",
    "...h.h...h.h....",
  ],
  [
    "..........OOO...",
    ".........OOOOO..",
    "oO.......hOOkOO.",
    "..O.....hhOOOOOn",
    "..OOOOOOhhhOuu..",
    "..OoooooOhhu....",
    "..OOOOOOOOhu....",
    "...hOOOOOOh.....",
    "..h...h.h...h...",
    ".h.....h.....h..",
  ],
  [
    "..OOOOOO.........",
    ".OoooooOO...OOO..",
    "OOOOOOOOOO.OOOOO.",
    "OOOOOOOOOhhOkkOOn",
    "uOOOOOOOhhhOOOOu.",
    ".uuOOOOOOhhuuuu..",
  ],
);

const RABBIT = pet(
  RABBIT_KEY,
  "bun-deep",
  [
    "......OO....",
    "......pO....",
    ".....OpO....",
    ".....OOOOO..",
    "..OOOOOOkOOn",
    ".OOoooOOOOO.",
    "uOOOOOOOOh..",
    ".OOOOOOOOh..",
    ".hhh...hh...",
  ],
  [
    ".....OO.....",
    ".....pO.....",
    "....OpO.....",
    "....OOOOOO..",
    "..OOOOOOkOOn",
    "uOOoooOOOOO.",
    ".OOOOOOOOh..",
    "hhOOOOOOh...",
    "..........h.",
  ],
  [
    "....OOOO....",
    "...OpOOOOO..",
    "..OOOOOOhOOn",
    ".OOoooOOOOO.",
    "uOOOOOOOOO..",
    ".hhhhhhhh...",
  ],
);

const HEDGEHOG = pet(
  HEDGEHOG_KEY,
  "hog-deep",
  [
    "...mOom.......",
    "..mOomOom.....",
    ".mOomOomOuu...",
    "mOomOomOuuku..",
    "OomOomOuuuuuun",
    ".hh....hh.....",
  ],
  [
    "...mOom.......",
    "..mOomOom.....",
    ".mOomOomOuu...",
    "mOomOomOuuku..",
    "OomOomOuuuuuun",
    "h..h...h..h...",
  ],
  [
    "..omOom..",
    ".omOomOo.",
    "omOomOomO",
    "mOomOomuu",
    "OomOomuun",
    ".hhhhhh..",
  ],
);

const FOX = pet(
  FOX_KEY,
  "fox-deep",
  [
    "............O..O.",
    "............OOOO.",
    "............OOkOOO",
    "............OuuuOn",
    ".OOO.......OOuu...",
    "uOOOOOOOOOOOOu....",
    "uuOOOoooooOOOu....",
    ".u..OOOOOOOOu.....",
    "....m.m....m.m....",
    "....m.m....m.m....",
  ],
  [
    "............O..O.",
    "............OOOO.",
    "............OOkOOO",
    "............OuuuOn",
    "..OO.......OOuu...",
    "uOOOOOOOOOOOOu....",
    "uuOOOoooooOOOu....",
    "....OOOOOOOOu.....",
    "...m...m..m...m...",
    "..m.....mm.....m..",
  ],
  [
    "....OOOOOO......",
    "..OOOoooooOOO...",
    ".OOOOOOOOOOOOO..",
    "OOOOOOOO.O..OOO.",
    "OOOOOuuuuuOOOkOn",
    "uOOuuuuuuuuuOOO.",
    ".uuuuu.mm..mm...",
  ],
);

const DRAGON = pet(
  DRAGON_KEY,
  "drg-deep",
  [
    "...........n..n.",
    "....W......OOOO.",
    "...WwW....OOkOOO",
    "..WwwW....OOOOOp",
    "..WwwwW..OOOuu..",
    "m.mWWWWmOOOuu...",
    "nOOOOOOOOOuuu...",
    ".OOoooOOOOuu....",
    "..OOOOOOOOu.....",
    "..h.h...h.h.....",
    "..h.h...h.h.....",
  ],
  [
    "...........n..n.",
    ".WW........OOOO.",
    "..WwW.....OOkOOO",
    "...WwW....OOOOOp",
    "...WwwW..OOOuu..",
    "m.mmWWWmOOOuu...",
    "nOOOOOOOOOuuu...",
    ".OOoooOOOOuu....",
    "..OOOOOOOOu.....",
    ".h...h.h...h....",
    "h.....h.....h...",
  ],
  [
    "...m.m.m.........",
    "..WWWWWOO....n.n.",
    ".WwwwwWOOO..OOOO.",
    "OOWWWWOOOOOOOhhOO",
    "nOOOOOOOOOOOOOOOp",
    ".OOuuuuuuuuuuOO..",
  ],
);

export const PET_ART: Record<Exclude<Pet, "none">, PetArt> = {
  cat: CAT,
  dog: DOG,
  rabbit: RABBIT,
  hedgehog: HEDGEHOG,
  fox: FOX,
  dragon: DRAGON,
};

export const petArt = (p: Pet): PetArt | null => (p === "none" ? null : PET_ART[p]);
