import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 4.1: Turbopack handles Workers natively; we fall back to Webpack for production to avoid bundling timeouts
  serverExternalPackages: [
    'elkjs', 
    'drizzle-orm', 
    '@auth/drizzle-adapter', 
    'better-sqlite3', 
    'uuid',
    'mathjs',
    'nerdamer',
    'vega',
    'vega-lite',
    'canvas'
  ],
  transpilePackages: ['mathjs', 'nerdamer', 'elkjs', 'vega', 'vega-lite'],
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Enable native Web Worker support (webpack 5 production builds)
    if (config.output) {
      config.output.workerChunkLoading = 'import';
    }
    return config;
  },
};

export default nextConfig;
