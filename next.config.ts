import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? undefined : ".next.nosync",
  allowedDevOrigins: ["192.168.1.3"],
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
