import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any HTTPS source (profile pictures stored as data URLs or external URLs)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
  },
  // Disable strict mode to prevent double socket connections in development
  reactStrictMode: false,
  // Improve production build performance
  poweredByHeader: false,
};

export default nextConfig;
