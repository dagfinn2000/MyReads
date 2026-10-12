import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server bundle that the
  // Dockerfile copies into a minimal runtime image (no full node_modules).
  output: "standalone",
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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Browsers take each response for the type it says it is.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Links out (Find it at, catalogue pages) say which site the
          // reader came from, not which book page.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
