import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack disabled for production builds due to timeout issues.
  
  // Externalize heavy libraries to avoid bundling them into serverless functions.
  // This keeps the cold start fast and the deployment manageable.
  serverExternalPackages: [
    'elkjs', 
    'mathjs',
    'nerdamer',
    'vega',
    'vega-lite',
    'canvas'
  ],

  // Standalone output is not required for Vercel
  // Optimization: Disable source maps to save memory during the bundling phase
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Note: No custom webpack or Turbopack config needed for standard Vercel deployment.
};

export default nextConfig;
