import { afterEach, describe, expect, it, vi } from "vitest";
import { shakeNo } from "./motion";

/** Just enough of a browser for motionAllowed: the <html> dataset and the
 *  reduced-motion media query. */
function browser({ reduce = false, motion }: { reduce?: boolean; motion?: string } = {}) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduce }) });
  vi.stubGlobal("document", { documentElement: { dataset: motion ? { motion } : {} } });
}

function element() {
  return { animate: vi.fn() } as unknown as HTMLElement & { animate: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shakeNo", () => {
  it("shakes side to side once and ends where it started", () => {
    browser();
    const el = element();
    shakeNo(el);
    expect(el.animate).toHaveBeenCalledTimes(1);
    const [frames, timing] = el.animate.mock.calls[0];
    // Only `translate`, so the element's own transform is left alone.
    for (const frame of frames) {
      expect(Object.keys(frame).filter((k) => k !== "offset" && k !== "easing")).toEqual(["translate"]);
      expect(frame.translate).toMatch(/ 0$/);
    }
    expect(frames[0].translate).toBe("0 0");
    expect(frames.at(-1).translate).toBe("0 0");
    expect(timing.iterations ?? 1).toBe(1);
    expect(timing.duration).toBeLessThanOrEqual(600);
  });

  it("stays still when the device asks for reduced motion", () => {
    browser({ reduce: true });
    const el = element();
    shakeNo(el);
    expect(el.animate).not.toHaveBeenCalled();
  });

  it("stays still when Animations are off in Preferences", () => {
    browser({ motion: "off" });
    const el = element();
    shakeNo(el);
    expect(el.animate).not.toHaveBeenCalled();
  });

  it("does nothing without an element", () => {
    browser();
    expect(() => shakeNo(null)).not.toThrow();
  });
});
