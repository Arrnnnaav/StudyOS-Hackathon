import type { NextConfig } from "next";
import { securityHeaders } from './src/shared/security-headers'

const nextConfig: NextConfig = {
  // External TS validation is run separately via `pnpm exec tsc --noEmit`.
  // Letting Next spawn the typechecker breaks in sandboxed/hosted CI builds.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: securityHeaders(process.env.NODE_ENV !== 'production'),
    }]
  },
};

export default nextConfig;
