/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enables src/instrumentation.ts — process-level error handlers
    // prevent silent crashloops on uncaughtException / unhandledRejection.
    instrumentationHook: true,
  },
  images: {
    // Team photos hosted on the marketing site (creativenexus.in/wp-content)
    // and the WordPress Shopify shop subdomain (creativefunda.com). Whitelist
    // both so next/image can optimize them without blocking.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "creativenexus.in",
        pathname: "/wp-content/**",
      },
      {
        protocol: "https",
        hostname: "www.creativenexus.in",
        pathname: "/wp-content/**",
      },
    ],
  },
  async rewrites() {
    // Hostinger hCDN's WAF blocks short single-segment /api/* paths
    // (returns 403). We expose the same routes under /xapi/* — multi-segment
    // and custom-prefixed, which sails past the WAF rules. Both work; new
    // client code uses /xapi/*.
    return [
      { source: "/xapi/:path*", destination: "/api/:path*" },
    ];
  },
};

export default nextConfig;
