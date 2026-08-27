import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const TITULO = "Observatorio de contratación · Archipiélago de San Andrés";
const DESCRIPCION =
  "Observatorio ciudadano de la contratación pública de la Gobernación del " +
  "Departamento Archipiélago de San Andrés, Providencia y Santa Catalina, " +
  "construido sobre los datos abiertos del SECOP publicados en datos.gov.co.";

export const metadata: Metadata = {
  title: { default: TITULO, template: "%s · Observatorio del Archipiélago" },
  description: DESCRIPCION,
  applicationName: "Observatorio de contratación del Archipiélago",
  openGraph: { title: TITULO, description: DESCRIPCION, locale: "es_CO", type: "website" },
  robots: { index: true, follow: true },
};

// Evita el parpadeo de tema: corre antes del primer pintado.
const TEMA_INICIAL = `(function(){try{var t=localStorage.getItem("tema");
if(t==="claro")document.documentElement.setAttribute("data-theme","light");
else if(t==="oscuro")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
