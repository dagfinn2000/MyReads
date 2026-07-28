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

/** Blocked IPv6 ranges: loopback, unspecified, link-local, unique-local,
 *  multicast, and anything embedding a blocked IPv4 address. */
function isBlockedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id

  if (addr === "::" || addr === "::1") return true;

  // IPv4-mapped (::ffff:10.0.0.1) and IPv4-compatible forms delegate to the
  // v4 rules — otherwise they'd be an trivial bypass.
  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  if (addr.startsWith("fe8") || addr.startsWith("fe9")) return true; // fe80::/10
  if (addr.startsWith("fea") || addr.startsWith("feb")) return true;
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 ULA
  if (addr.startsWith("ff")) return true; // ff00::/8 multicast

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
