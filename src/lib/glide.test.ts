import { describe, expect, it } from "vitest";
import { glideDuration } from "@/lib/glide";

describe("glideDuration", () => {
  it("takes a little longer for a long way, within bounds", () => {
    expect(glideDuration(0)).toBe(380);
    expect(glideDuration(400)).toBe(480);
    expect(glideDuration(5000)).toBe(600);
  });
});
