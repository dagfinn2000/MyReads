import { describe, expect, it } from "vitest";
// The one place that compares against Prisma's own values.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { $Enums } from "@prisma/client";
import { BookFormat, BookOwnership, GoalSpan, GoalUnit, ReadingStatus } from "@/lib/enums";

describe("enums", () => {
  it("match the schema's enums exactly", () => {
    expect(ReadingStatus).toEqual($Enums.ReadingStatus);
    expect(BookFormat).toEqual($Enums.BookFormat);
    expect(BookOwnership).toEqual($Enums.BookOwnership);
    expect(GoalUnit).toEqual($Enums.GoalUnit);
    expect(GoalSpan).toEqual($Enums.GoalSpan);
  });

  it("cover every enum in the schema", () => {
    expect(Object.keys($Enums).sort()).toEqual(
      ["BookFormat", "BookOwnership", "GoalSpan", "GoalUnit", "ReadingStatus"],
    );
  });
});
