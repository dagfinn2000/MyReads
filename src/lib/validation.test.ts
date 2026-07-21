import { describe, expect, it } from "vitest";
import { bookSchema } from "@/lib/validation";

const minimalForm = {
  title: "T",
  authors: "",
  tags: "",
  format: "PHYSICAL",
  owned: "true",
};

describe("bookSchema tags", () => {
  it("splits, trims, and lowercases the comma-separated field", () => {
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: " Fantasy , Sci-Fi ,",
    });
    expect(parsed.tags).toEqual(["fantasy", "sci-fi"]);
  });

  it("dedupes tags that collide after lowercasing", () => {
    // Metadata subjects often differ only in case — "Fiction, fiction"
    // must not land twice (duplicate React keys on the book page).
    const parsed = bookSchema.parse({
      ...minimalForm,
      tags: "Fiction, fiction, FICTION, fantasy",
    });
    expect(parsed.tags).toEqual(["fiction", "fantasy"]);
  });
});
