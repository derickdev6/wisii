import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` y `next dev` comparten .next y se pisan: un build mientras el
  // servidor de desarrollo corre lo deja sirviendo 500. Con esto, una
  // verificación puede escribir en otro directorio (ver `npm run check`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  headers: async () => [
    {
      // los JSON se regeneran en cada build; cachear fuerte y revalidar por deploy
      source: "/data/:file*",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" }],
    },
  ],
};

export default nextConfig;
