import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "yts.mx" },
      { protocol: "https", hostname: "img.yts.mx" },
    ],
  },
};

export default nextConfig;
