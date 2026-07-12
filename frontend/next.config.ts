import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:37900/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:37900/uploads/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '37900' },
    ],
  },
};

export default nextConfig;
