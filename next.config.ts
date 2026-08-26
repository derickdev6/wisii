import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      // los JSON se regeneran en cada build; cachear fuerte y revalidar por deploy
      source: "/data/:file*",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" }],
    },
  ],
};

export default nextConfig;
