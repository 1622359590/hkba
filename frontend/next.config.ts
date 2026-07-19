import type { NextConfig } from "next";

const API_INTERNAL = process.env.HKBA_API_INTERNAL || "http://127.0.0.1:37900";

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
  // Redirects table takes effect at the Next.js layer (M8; decision D8).
  // Rows are pulled from the backend at build time; a backend that is down
  // or has no rows yet yields zero redirects and the site builds normally.
  // Rows added after a deploy take effect on the next build.
  async redirects() {
    try {
      const res = await fetch(`${API_INTERNAL}/api/public/redirects`, { cache: 'no-store' });
      if (!res.ok) return [];
      const body = await res.json();
      const items: { from: string; to: string; statusCode: number }[] = body?.data?.items || [];
      return items.map((item) => ({
        source: item.from,
        destination: item.to,
        permanent: item.statusCode === 301,
      }));
    } catch {
      return [];
    }
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '37900' },
    ],
  },
};

export default nextConfig;
