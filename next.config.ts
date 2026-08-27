import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` y `next dev` comparten .next y se pisan: un build mientras el
  // servidor de desarrollo corre lo deja sirviendo 500. Con esto, una
  // verificación puede escribir en otro directorio (ver `npm run check`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    // El editor de barrios escribe data/gazetteer.json en disco, algo imposible
    // en Vercel (filesystem de solo lectura). Se resuelve en tiempo de build:
    // en un despliegue la pestaña no se muestra ni se descarga su código.
    NEXT_PUBLIC_EDITOR_BARRIOS: process.env.VERCEL ? "0" : "1",
  },
  headers: async () => [
    {
      // los JSON se regeneran en cada build; cachear fuerte y revalidar por deploy
      source: "/data/:file*",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" }],
    },
  ],
};

export default nextConfig;
