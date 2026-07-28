import { afterEach, describe, expect, it, vi } from "vitest";
import dns from "node:dns/promises";
import { checkUrlAllowed, isBlockedAddress } from "@/lib/net-guard";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.COVER_FETCH_ALLOW_PRIVATE;
});

describe("isBlockedAddress", () => {
  it("blocks IPv4 loopback and private ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.1",
      "10.255.255.255",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "100.64.0.1",
      "0.0.0.0",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("blocks the cloud metadata endpoint", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("169.254.0.1")).toBe(true);
  });

  it("blocks multicast and reserved space", () => {
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
  });

  it("allows ordinary public IPv4", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.15.0.1", "172.32.0.1", "93.184.216.34"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, link-local, ULA and multicast", () => {
    for (const ip of ["::1", "::", "fe80::1", "fd00::1", "fc00::1", "ff02::1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("blocks IPv4-mapped IPv6 forms of private addresses", () => {
    // The obvious bypass: ::ffff:127.0.0.1 is loopback wearing a v6 hat.
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:192.168.0.1")).toBe(true);
  });

  it("allows public IPv6", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("refuses anything that is not an IP", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("checkUrlAllowed", () => {
  it("rejects non-http protocols", async () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/x.jpg", "data:image/png;base64,AAAA"]) {
      expect((await checkUrlAllowed(url)).ok, url).toBe(false);
    }
  });

  it("rejects unparseable URLs", async () => {
    expect((await checkUrlAllowed("not a url")).ok).toBe(false);
  });

  it("rejects literal private addresses without a DNS lookup", async () => {
    const lookup = vi.spyOn(dns, "lookup");
    expect((await checkUrlAllowed("http://127.0.0.1/cover.jpg")).ok).toBe(false);
    expect((await checkUrlAllowed("http://[::1]/cover.jpg")).ok).toBe(false);
    expect((await checkUrlAllowed("http://169.254.169.254/latest/meta-data")).ok).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("allows a host resolving to a public address", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect((await checkUrlAllowed("https://covers.example.org/a.jpg")).ok).toBe(true);
  });

  it("rejects a host that resolves to a private address (DNS rebinding)", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "192.168.1.50", family: 4 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect((await checkUrlAllowed("https://evil.example.com/a.jpg")).ok).toBe(false);
  });

  it("rejects when ANY resolved address is private", async () => {
    // Split-horizon DNS: one public answer, one internal. Checking only the
    // first would let this through depending on resolver ordering.
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    expect((await checkUrlAllowed("https://mixed.example.com/a.jpg")).ok).toBe(false);
  });

  it("rejects a host that does not resolve", async () => {
    vi.spyOn(dns, "lookup").mockRejectedValue(new Error("ENOTFOUND"));
    expect((await checkUrlAllowed("https://nope.example.com/a.jpg")).ok).toBe(false);
  });

  it("honours the COVER_FETCH_ALLOW_PRIVATE escape hatch", async () => {
    process.env.COVER_FETCH_ALLOW_PRIVATE = "true";
    expect((await checkUrlAllowed("http://192.168.1.10/cover.jpg")).ok).toBe(true);
    // Still refuses non-http schemes — that is not what the flag is for.
    expect((await checkUrlAllowed("file:///etc/passwd")).ok).toBe(false);
  });
});
