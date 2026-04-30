/** @type {import('next').NextConfig} */
const nextConfig = {
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
