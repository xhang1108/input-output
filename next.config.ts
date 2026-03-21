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

  // Optimization: Disable source maps to save memory during the bundling phase
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  async redirects() {
    return [
      {
        source: '/user',
        destination: '/wiki/user',
        permanent: true,
      },
      {
        source: '/developer',
        destination: '/wiki/developer',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
