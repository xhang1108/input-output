import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Acknowledge Turbopack per the CLI's suggestion for Next.js 16+
  turbopack: {},
  
  // Mark heavy modules as external to avoid OOM during bundling
  serverExternalPackages: [
    'elkjs', 
    'drizzle-orm', 
    'mathjs',
    'nerdamer',
    'vega',
    'vega-lite',
    'canvas'
  ],

  // Standalone output is more reliable for Cloudflare/Serverless environments
  output: 'standalone',

  // Optimization: Disable source maps to save memory
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Note: 'eslint' key is intentionally omitted as it was reported as unrecognized in the build logs.
};

export default nextConfig;
