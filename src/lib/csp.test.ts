import { afterEach, describe, expect, it } from "vitest";
import { makeNonce, pagePolicy } from "@/lib/csp";

/** The Content-Security-Policy every page is sent with (proxy.ts). */

const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(name + " "));

afterEach(() => {
  delete process.env.AUTH_URL;
});

describe("pagePolicy", () => {
  it("runs only the app's own scripts and the ones carrying this response's nonce", () => {
    const policy = pagePolicy("abc123==", false);
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(policy).not.toContain("unsafe-eval");
    expect(directive(policy, "script-src")).not.toContain("unsafe-inline");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
  });

  it("lets the browser ask this site and the weather service, nowhere else", () => {
    expect(directive(pagePolicy("n", false), "connect-src")).toBe(
      "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
    );
  });

  it("adds AUTH_URL's address where sign-in may send a form or a request", () => {
    process.env.AUTH_URL = "https://books.example.org/some/path";
    const policy = pagePolicy("n", false);
    expect(directive(policy, "form-action")).toBe("form-action 'self' https://books.example.org");
    expect(directive(policy, "connect-src")).toContain("'self' https://books.example.org ");
    process.env.AUTH_URL = "not a url";
    expect(directive(pagePolicy("n", false), "form-action")).toBe("form-action 'self'");
  });

  it("allows what the development server needs, there only", () => {
    const policy = pagePolicy("n", true);
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toContain("ws: wss:");
  });
});

describe("makeNonce", () => {
  it("is fresh and unguessable each time, in characters a policy can hold", () => {
    const nonces = new Set(Array.from({ length: 200 }, makeNonce));
    expect(nonces.size).toBe(200);
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
