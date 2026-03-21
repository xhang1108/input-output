import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 4.1: Turbopack handles Workers natively; webpack config is for production builds
  turbopack: {},
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
  webpack: (config) => {
    // Enable native Web Worker support (webpack 5 production builds)
    if (config.output) {
      config.output.workerChunkLoading = 'import';
    }
    return config;
  },
};

export default nextConfig;
