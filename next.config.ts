import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server bundle that the
  // Dockerfile copies into a minimal runtime image (no full node_modules).
  output: "standalone",
};

export default nextConfig;
