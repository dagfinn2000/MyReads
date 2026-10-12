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

  /** Hits in the key's open window and how long until it resets; zeros
   *  when no window is open. */
  usage(key: string): { count: number; resetInMs: number } {
    const b = this.buckets.get(key);
    const now = Date.now();
    if (!b || now >= b.resetAt) return { count: 0, resetInMs: 0 };
    return { count: b.count, resetInMs: b.resetAt - now };
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

/**
 * The client address, read from x-forwarded-for.
 *
 * Counted from the *right*, not the left. X-Forwarded-For is a client-supplied
 * header that each proxy appends to — nginx's standard
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` produces
 * "<whatever the client sent>, <real client IP>". Taking the leftmost entry
 * therefore hands the rate limiter a value the attacker chose, and rotating it
 * defeats the per-IP budget entirely. The rightmost entries are the ones your
 * own infrastructure appended and can be trusted.
 *
 * TRUSTED_PROXY_HOPS is how many proxies sit between the app and the internet
 * (default 1 — the usual single reverse proxy). With two hops, the real client
 * is the second address from the right, and so on. Set it to match your
 * deployment; too high hands trust back to the client, too low keys on your
 * own proxy's address and throttles everyone as one pool.
 *
 * No header at all (direct LAN access, no proxy) falls back to a shared key —
 * better to throttle direct-connection clients as one pool than not at all.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";

  const chain = forwarded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length === 0) return "unknown";

  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  const trusted = Number.isFinite(hops) && hops >= 1 ? hops : 1;

  // Clamp: a chain shorter than the configured hop count means the header
  // didn't come through the expected path, so use the leftmost entry we have
  // rather than reading off the end of the array.
  const index = Math.max(chain.length - trusted, 0);
  return chain[index] || "unknown";
}

// Module-level singletons, hung on globalThis so dev hot-reload doesn't
// reset the counters (same pattern as lib/prisma.ts).
const globalForRateLimit = globalThis as unknown as {
  loginLimiter?: RateLimiter;
  registerLimiter?: RateLimiter;
  metadataLimiter?: RateLimiter;
  uploadLimiter?: RateLimiter;
};

/** Failed sign-in attempts: 10 per username (and 10 per IP) per 15 minutes.
 *  Also guards the "confirm your password" checks on the account page. */
export const loginLimiter = (globalForRateLimit.loginLimiter ??=
  new RateLimiter(10, 15 * 60_000));

/** Account creation: 10 attempts per IP per hour — roomy for a human
 *  fumbling the password rules, useless for flooding junk accounts. */
export const registerLimiter = (globalForRateLimit.registerLimiter ??=
  new RateLimiter(10, 60 * 60_000));

/**
 * Outbound metadata lookups: 90 per signed-in user per minute.
 *
 * Unlike the auth limiters this counts *every* call, not just failures — the
 * budget being protected is Open Library's and nb.no's, not ours. Each search
 * fans out to three catalogues, so 90/min is roughly 30 searches a minute:
 * far more than a human types, and a hard stop on a stuck retry loop or a
 * script pointed at the endpoint.
 */
export const METADATA_LOOKUPS_PER_MINUTE = 90;
export const metadataLimiter = (globalForRateLimit.metadataLimiter ??=
  new RateLimiter(METADATA_LOOKUPS_PER_MINUTE, 60_000));

/**
 * Cover uploads: 60 per signed-in user per hour. Counts every upload, like
 * the metadata budget. One a minute is more than anyone photographing their
 * shelf needs, and it caps how fast one account can fill the disk (each
 * upload may be up to 10 MB).
 */
export const uploadLimiter = (globalForRateLimit.uploadLimiter ??=
  new RateLimiter(60, 60 * 60_000));
