import { describe, expect, it } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";

/**
 * The proxy: signed-out visitors go to /login, and every page it lets
 * through gets a Content-Security-Policy with a nonce of its own, which
 * Next also sees on the request (to mark its scripts) along with x-nonce
 * (for the root layout's pre-paint script).
 */

process.env.AUTH_SECRET ??= "test-secret-for-the-proxy-test-only-32b";
process.env.AUTH_TRUST_HOST = "true";
const { default: proxy } = await import("@/proxy");

const visit = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`), {} as NextFetchEvent);

describe("proxy", () => {
  it("gives a page it lets through a policy with a fresh nonce, on the response and the request", async () => {
    const [a, b] = [await visit("/login"), await visit("/offline")];
    for (const res of [a, b]) {
      const policy = res.headers.get("content-security-policy") ?? "";
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
      expect(nonce).toBeTruthy();
      expect(res.headers.get("x-middleware-next")).toBe("1");
      // What Next hands on to the page as the request's own headers.
      expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
      expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    }
    expect(a.headers.get("content-security-policy")).not.toBe(b.headers.get("content-security-policy"));
  });

  it("still sends a signed-out visitor to /login, and leaves API routes their own headers", async () => {
    const page = await visit("/books");
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!).pathname).toBe("/login");
    const api = await visit("/api/quick-find?q=a");
    expect(api.headers.get("content-security-policy")).toBeNull();
  });
});
