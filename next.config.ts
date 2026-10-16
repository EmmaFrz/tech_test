import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

import type { NextConfig } from 'next';

const DEFAULT_WS_PROXY_TARGET = 'http://localhost:4000';

const baseConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  // Keep `next dev` from writing files into the working tree.
  agentRules: false,
  typescript: { tsconfigPath: 'tsconfig.app.json' },
};

/**
 * Production traffic reaches `/ws` through the nginx edge, so only the development server proxies
 * the socket itself; a rewrite would otherwise be baked into the production build.
 */
export default function createConfig(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) {
    return baseConfig;
  }

  const target = process.env['WS_PROXY_TARGET'] ?? DEFAULT_WS_PROXY_TARGET;
  return {
    ...baseConfig,
    rewrites: () => Promise.resolve([{ source: '/ws', destination: `${target}/ws` }]),
  };
}
