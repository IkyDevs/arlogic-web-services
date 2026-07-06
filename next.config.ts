import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "pub-*.r2.dev",
      },
    ],
  },
  // Moved from experimental.serverComponentsExternalPackages (Next.js 15+)
  serverExternalPackages: ["sharp"],
  compress: true,
};

export default nextConfig;
