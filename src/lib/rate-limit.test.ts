import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks a key once it collects max hits in a window", () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.blocked("k")).toBe(false);
    expect(limiter.hit("k")).toBe(false);
    expect(limiter.hit("k")).toBe(false);
    expect(limiter.hit("k")).toBe(true); // third hit trips the limit
    expect(limiter.blocked("k")).toBe(true);
  });

  it("unblocks when the window expires", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.hit("k");
    limiter.hit("k");
    expect(limiter.blocked("k")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(limiter.blocked("k")).toBe(false);
  });

  it("starts a fresh window when a hit lands after expiry", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.hit("k");
    vi.advanceTimersByTime(1500);
    expect(limiter.hit("k")).toBe(false); // count restarted at 1
    expect(limiter.blocked("k")).toBe(false);
  });

  it("clear() forgives a key immediately", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.hit("k");
    expect(limiter.blocked("k")).toBe(true);
    limiter.clear("k");
    expect(limiter.blocked("k")).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.hit("alice");
    expect(limiter.blocked("alice")).toBe(true);
    expect(limiter.blocked("bob")).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first address in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.7, 172.16.0.1" });
    expect(clientIp(headers)).toBe("10.0.0.7");
  });

  it("falls back to a shared pool key without the header", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
