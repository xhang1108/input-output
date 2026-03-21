import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack disabled for production builds due to timeout issues.
  
  // Phase 4.1: Externalize heavy libraries to CDN to bypass 20-minute build timeouts.
  serverExternalPackages: [
    'elkjs', 
    'mathjs',
    'nerdamer',
    'vega',
    'vega-lite',
    'canvas'
  ],

  // Standalone output is required for Next.js full-stack features (API routes, Auth)
  output: 'standalone',

  // Optimization: Disable source maps to save memory during the bundling phase
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Note: 'transpilePackages' has been removed for packages that are already in 'serverExternalPackages'.
  // transpilePackages: [],

  /* 
   * Externalization is managed through code-level conditional loading (window vs eval('require')).
   * We use the Webpack block as a fallback for stability when not using Turbopack.
   */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = [...(config.externals || []), {
        mathjs: 'math',
        nerdamer: 'nerdamer'
      }];
    }
    return config;
  }
};

export default nextConfig;
