/**
 * Animals in the reading room: a pet who trots after the avatar and curls
 * up at its feet while it reads, and the coats of the house's cats and of
 * the dog in its basket. The pictures are in components/pet-art.ts; the
 * coats are colours, in reading-room.css.
 */

export const PETS = ["none", "cat", "dog", "rabbit", "hedgehog", "fox", "dragon"] as const;
export type Pet = (typeof PETS)[number];

export const CAT_COATS = ["ginger", "tabby", "black", "white", "grey", "calico", "siamese"] as const;
export type CatCoat = (typeof CAT_COATS)[number];

export const DOG_COATS = ["brown", "golden", "black", "grey", "cream", "red"] as const;
export type DogCoat = (typeof DOG_COATS)[number];

export const PET_LABELS: Record<Pet | CatCoat | DogCoat, string> = {
  none: "No pet",
  cat: "A cat",
  dog: "A dog",
  rabbit: "A rabbit",
  hedgehog: "A hedgehog",
  fox: "A fox",
  dragon: "A little dragon",
  ginger: "Ginger",
  tabby: "Tabby",
  black: "Black",
  white: "White",
  grey: "Grey",
  calico: "Calico",
  siamese: "Siamese",
  brown: "Brown and white",
  golden: "Golden",
  cream: "Cream",
  red: "Red",
};

const oneOf =
  <T extends string>(list: readonly T[], fallback: T) =>
  (value: unknown): T =>
    list.includes(value as T) ? (value as T) : fallback;

export const parsePet = oneOf(PETS, "none");
export const parseCatCoat = oneOf(CAT_COATS, "ginger");
export const parseDogCoat = oneOf(DOG_COATS, "brown");
