import { describe, expect, it } from "vitest";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig, { SITE_POLICY_PATHS } from "../../next.config";

/**
 * The headers every response gets (next.config.ts). A header set there
 * replaces one of the same name that a route sets itself, which once left
 * the monthly email's preview and its stop link without their own strict
 * Content-Security-Policy and Referrer-Policy.
 */

// The way Next matches a `source` in headers() (buildCustomRoute in
// next/dist/server/lib/router-utils/filesystem.js).
const matches = (source: string, path: string) =>
  getPathMatch(source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex) => modifyRouteRegex(regex),
  })(path) !== false;

async function headersFor(path: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const rule of (await nextConfig.headers?.()) ?? []) {
    if (!matches(rule.source, path)) continue;
    for (const h of rule.headers) out.set(h.key, h.value);
  }
  return out;
}

describe("security headers", () => {
  it("frames nothing and sniffs nothing, everywhere", async () => {
    for (const path of ["/", "/books", "/api/export", "/api/email/monthly", "/api/email/unsubscribe"]) {
      const h = await headersFor(path);
      expect(h.get("X-Frame-Options"), path).toBe("DENY");
      expect(h.get("X-Content-Type-Options"), path).toBe("nosniff");
    }
  });

  it("gives every page the site's policy", async () => {
    for (const path of ["/", "/books", "/books/abc", "/login", "/api/export", "/api/emails"]) {
      const h = await headersFor(path);
      expect(h.get("Content-Security-Policy"), path).toBe("frame-ancestors 'none'");
      expect(h.get("Referrer-Policy"), path).toBe("strict-origin-when-cross-origin");
    }
  });

  it("leaves the monthly email's pages their own, stricter policies", async () => {
    expect(SITE_POLICY_PATHS).toContain("api/email/");
    for (const path of ["/api/email/monthly", "/api/email/unsubscribe"]) {
      const h = await headersFor(path);
      expect(h.has("Content-Security-Policy"), path).toBe(false);
      expect(h.has("Referrer-Policy"), path).toBe(false);
    }
  });
});
