import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Acknowledge Turbopack per the CLI's suggestion for Next.js 16+
  turbopack: {},
  
  // Phase 4.1: Externalize heavy libraries to CDN to bypass 20-minute build timeouts.
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

  // Optimization: Disable source maps to save memory during the bundling phase
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Note: 'transpilePackages' has been removed for packages that are already in 'serverExternalPackages'.
  // transpilePackages: [],

  /* 
   * NOTE: Custom 'webpack' block has been removed to resolve TurbopackInternalError in Next.js 16.
   * Externalization is now handled via code-level conditional loading (window vs eval('require')).
   */
};

export default nextConfig;
