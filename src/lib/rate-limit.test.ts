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
  const withHops = (hops: string | undefined, fn: () => void) => {
    const prev = process.env.TRUSTED_PROXY_HOPS;
    if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = hops;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = prev;
    }
  };

  it("takes the address the trusted proxy appended, not the client's", () => {
    // nginx's proxy_add_x_forwarded_for appends the real peer to whatever the
    // client sent, so the rightmost entry is ours and the leftmost is theirs.
    const headers = new Headers({ "x-forwarded-for": "10.0.0.7, 172.16.0.1" });
    withHops(undefined, () => expect(clientIp(headers)).toBe("172.16.0.1"));
  });

  it("ignores a spoofed chain prepended by the client", () => {
    // An attacker rotating the forged prefix must not get a fresh budget.
    const forge = (fake: string) =>
      clientIp(new Headers({ "x-forwarded-for": `${fake}, 203.0.113.9` }));
    withHops(undefined, () => {
      expect(forge("1.2.3.4")).toBe("203.0.113.9");
      expect(forge("5.6.7.8")).toBe("203.0.113.9");
      expect(forge("9.9.9.9, 8.8.8.8")).toBe("203.0.113.9");
    });
  });

  it("counts back further when more proxies are in front", () => {
    const headers = new Headers({
      "x-forwarded-for": "10.0.0.7, 203.0.113.9, 172.16.0.1",
    });
    withHops("2", () => expect(clientIp(headers)).toBe("203.0.113.9"));
  });

  it("clamps to the leftmost entry when the chain is shorter than configured", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
    withHops("3", () => expect(clientIp(headers)).toBe("203.0.113.9"));
  });

  it("falls back to one hop when TRUSTED_PROXY_HOPS is nonsense", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.7, 172.16.0.1" });
    withHops("not-a-number", () => expect(clientIp(headers)).toBe("172.16.0.1"));
    withHops("0", () => expect(clientIp(headers)).toBe("172.16.0.1"));
  });

  it("falls back to a shared pool key without the header", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("falls back to a shared pool key on an empty header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "  ,  " }))).toBe("unknown");
  });
});
