import type { NextConfig } from "next";

/** Every address but those under /api/email/ (see headers() below). */
export const SITE_POLICY_PATHS = "/:path((?!api/email/).*)";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server bundle that the
  // Dockerfile copies into a minimal runtime image (no full node_modules).
  output: "standalone",
  // Shipped as a package in that bundle rather than folded into the
  // server's code, so the housekeeping scripts in scripts/ can import it.
  serverExternalPackages: ["@prisma/adapter-pg"],
  // No "X-Powered-By: Next.js" on every response.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may show MyReads in a frame, where it could be
          // dressed up to trick a signed-in reader into clicking Delete.
          { key: "X-Frame-Options", value: "DENY" },
          // Browsers take each response for the type it says it is.
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Everything but the monthly email's two pages, which send stricter
        // ones of their own (nothing runs or loads there, and the stop link's
        // key never goes out as a referrer). A header set here replaces one
        // of the same name that a route sets, so these must leave them be.
        // Pages get a full policy from proxy.ts instead, which replaces this
        // one; it stays for everything else the proxy doesn't see.
        source: SITE_POLICY_PATHS,
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Links out (Find it at, catalogue pages) say which site the
          // reader came from, not which book page.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
