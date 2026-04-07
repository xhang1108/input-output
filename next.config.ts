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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.vercel-storage.com https://*.pusher.com; frame-src 'self'; worker-src 'self' blob:;" }
        ]
      }
    ];
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
