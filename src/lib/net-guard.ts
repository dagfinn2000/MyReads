/**
 * Guards outbound fetches of user-supplied URLs against SSRF.
 *
 * The book form accepts any image URL and the server downloads it into the
 * cover cache. Without a check that makes the app a probe into whatever else
 * is on its network — a self-hosted instance usually sits on a home LAN with
 * a router admin page, a NAS, and other containers reachable by name.
 *
 * Set COVER_FETCH_ALLOW_PRIVATE=true to turn this off, which is the right
 * call if you deliberately host cover images on the same LAN.
 */

import dns from "node:dns/promises";
import net from "node:net";

/** True when private-range fetching has been deliberately enabled. */
export function privateFetchAllowed(): boolean {
  return process.env.COVER_FETCH_ALLOW_PRIVATE === "true";
}

/**
 * Blocked IPv4 ranges: loopback, RFC1918 private, link-local (incl. the
 * 169.254.169.254 cloud metadata endpoint), CGNAT, broadcast/multicast,
 * "this network", and the reserved top block.
 */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // unparseable — refuse rather than guess
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 test
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

/**
 * Expands an IPv6 address into its eight 16-bit groups, or null if it can't
 * be read. Works on the numbers rather than the text because the same
 * address has many spellings: `new URL()` rewrites `[::ffff:127.0.0.1]` to
 * `[::ffff:7f00:1]`, so a check that only recognised the dotted form would
 * wave the hex form straight through.
 */
function ipv6Groups(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0]; // strip zone id

  // A trailing dotted quad (::ffff:10.0.0.1) is the last two groups.
  const dotted = addr.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    addr = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail].map((g) =>
    /^[0-9a-f]{1,4}$/.test(g) ? Number.parseInt(g, 16) : NaN,
  );
  return groups.some(Number.isNaN) ? null : groups;
}

/** The IPv4 address carried in two IPv6 groups, as a dotted quad. */
function embeddedIpv4(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** Blocked IPv6 ranges: loopback, unspecified, link-local, site-local,
 *  unique-local, multicast, Teredo, and anything embedding a blocked IPv4
 *  address. */
function isBlockedIpv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g) return true; // unparseable — refuse rather than guess
  const zero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);

  // Forms that carry an IPv4 address delegate to the v4 rules — otherwise
  // each would be a way to reach 127.0.0.1 or 169.254.169.254 in disguise.
  // ::/96 also covers :: (0.0.0.0) and ::1 (0.0.0.1), both blocked there.
  if (zero(0, 5) && g[5] === 0xffff) return isBlockedIpv4(embeddedIpv4(g[6], g[7])); // ::ffff:0:0/96 mapped
  if (zero(0, 6)) return isBlockedIpv4(embeddedIpv4(g[6], g[7])); // ::/96 compatible
  if (zero(0, 4) && g[4] === 0xffff && g[5] === 0) {
    return isBlockedIpv4(embeddedIpv4(g[6], g[7])); // ::ffff:0:0:0/96 translated
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6)) {
    return isBlockedIpv4(embeddedIpv4(g[6], g[7])); // 64:ff9b::/96 NAT64
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 64:ff9b:1::/48 local NAT64
  if (g[0] === 0x2002) return isBlockedIpv4(embeddedIpv4(g[1], g[2])); // 2002::/16 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // 2001::/32 Teredo

  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

/** True when this literal address must not be fetched. */
export function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true; // not an IP at all — refuse
}

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Resolves `url`'s hostname and rejects it if *any* returned address is in a
 * blocked range. All addresses are checked, not just the first: a host that
 * resolves to both a public and a private address would otherwise slip
 * through depending on resolver ordering.
 */
export async function checkUrlAllowed(url: string): Promise<UrlCheck> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "unparseable URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }

  if (privateFetchAllowed()) return { ok: true };

  const host = parsed.hostname.replace(/^\[|\]$/g, ""); // unwrap [::1]

  // A literal address needs no DNS round-trip.
  if (net.isIP(host)) {
    return isBlockedAddress(host)
      ? { ok: false, reason: `blocked address ${host}` }
      : { ok: true };
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: `could not resolve ${host}` };
  }
  if (addresses.length === 0) {
    return { ok: false, reason: `no addresses for ${host}` };
  }
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      return { ok: false, reason: `${host} resolves to blocked ${address}` };
    }
  }
  return { ok: true };
}
