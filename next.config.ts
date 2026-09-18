import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External TS validation is run separately via `pnpm exec tsc --noEmit`.
  // Letting Next spawn the typechecker breaks in sandboxed/hosted CI builds.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
