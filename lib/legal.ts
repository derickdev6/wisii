/**
 * Datos del responsable del sitio y textos legales.
 * Cambiá RESPONSABLE por el nombre real de la persona u organización que
 * publica el observatorio: aparece en el aviso de derechos del pie de página.
 */
export const RESPONSABLE = "Observatorio de Contratación del Archipiélago";
export const ANIO = new Date().getFullYear();
export const CONTACTO = ""; // opcional: correo de contacto para correcciones

export const FUENTES = [
  {
    nombre: "SECOP II · Contratos electrónicos",
    detalle: "Conjunto jbjy-vk9h · 2020-2026",
    url: "https://www.datos.gov.co/d/jbjy-vk9h",
  },
  {
    nombre: "SECOP I · Procesos de contratación",
    detalle: "Conjunto f789-7hwg · 2015-2022",
    url: "https://www.datos.gov.co/d/f789-7hwg",
  },
  {
    nombre: "OpenStreetMap",
    detalle: "Contornos de las islas y ubicación de barrios · ODbL",
    url: "https://www.openstreetmap.org/copyright",
  },
];

export const NORMAS = [
  {
    nombre: "Ley 1712 de 2014",
    detalle:
      "Transparencia y Acceso a la Información Pública Nacional. Define los datos " +
      "abiertos como información pública reutilizable de forma libre y sin restricciones.",
  },
  {
    nombre: "Términos de uso de datos.gov.co",
    detalle:
      "Autorizan expresamente la redistribución, compilación, extracción, copia, " +
      "difusión, modificación y adaptación de los datos publicados en el portal.",
    url: "https://herramientas.datos.gov.co/terminos",
  },
  {
    nombre: "Decreto 1081 de 2015 y Resolución 3564 de 2015 (MinTIC)",
    detalle:
      "Establecen cómo las entidades publican su información y los estándares " +
      "técnicos de apertura de datos.",
  },
];
