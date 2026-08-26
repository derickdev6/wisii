import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "Contratación · Gobernación de San Andrés",
  description:
    "Visualización de los contratos firmados por la Gobernación del Departamento " +
    "Archipiélago de San Andrés, Providencia y Santa Catalina desde 2025, " +
    "a partir de datos abiertos del SECOP II.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
