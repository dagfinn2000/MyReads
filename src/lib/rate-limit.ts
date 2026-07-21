/**
 * Minimal in-memory rate limiter for auth endpoints. A self-hosted MyReads
 * runs as a single Node process, so a Map is all the shared state needed —
 * no Redis, no extra service. State resets on restart, which is fine: the
 * point is to make online password guessing impractically slow, not to keep
 * a perfect ledger.
 *
 * Semantics are a fixed window: the first `hit()` on a key opens a window of
 * `windowMs`; once a window collects `max` hits, `blocked()` reports true
 * until the window expires. Callers count *failures* (a successful login
 * calls `clear()`), so legitimate users never see the limit.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when this window (and any block) expires
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    /** Hits allowed per window before the key blocks. */
    private readonly max: number,
    /** Window length in ms; also how long a block lasts. */
    private readonly windowMs: number,
  ) {}

  /** True while the key has exhausted its window. */
  blocked(key: string): boolean {
    const b = this.buckets.get(key);
    if (!b) return false;
    if (Date.now() >= b.resetAt) {
      this.buckets.delete(key);
      return false;
    }
    return b.count >= this.max;
  }

  /** Record one hit (a failed attempt). Returns true if the key is now blocked. */
  hit(key: string): boolean {
    this.prune();
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now >= b.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return this.max <= 1;
    }
    b.count++;
    return b.count >= this.max;
  }

  /** Forget a key — call on successful auth so honest mistakes don't accrue. */
  clear(key: string): void {
    this.buckets.delete(key);
  }

  /** Drop expired windows so the map can't grow unboundedly under a
   *  spread-out attack. O(size), but only runs on hits, and the map only
   *  holds keys that failed within the last window. */
  private prune(): void {
    const now = Date.now();
    for (const [key, b] of this.buckets) {
      if (now >= b.resetAt) this.buckets.delete(key);
    }
  }
}

/** First address in x-forwarded-for (set by the reverse proxy), or a shared
 *  fallback key — better to throttle direct-connection clients as one pool
 *  than not at all. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Module-level singletons, hung on globalThis so dev hot-reload doesn't
// reset the counters (same pattern as lib/prisma.ts).
const globalForRateLimit = globalThis as unknown as {
  loginLimiter?: RateLimiter;
  registerLimiter?: RateLimiter;
};

/** Failed sign-in attempts: 10 per username (and 10 per IP) per 15 minutes.
 *  Also guards the "confirm your password" checks on the account page. */
export const loginLimiter = (globalForRateLimit.loginLimiter ??=
  new RateLimiter(10, 15 * 60_000));

/** Account creation: 10 attempts per IP per hour — roomy for a human
 *  fumbling the password rules, useless for flooding junk accounts. */
export const registerLimiter = (globalForRateLimit.registerLimiter ??=
  new RateLimiter(10, 60 * 60_000));
