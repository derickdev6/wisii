import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Lee los JSON generados por scripts/build_data.py desde el sistema de archivos.
 * La portada se renderiza en el build, así que no descarga nada en el navegador
 * (contratos.json pesa 10 MB y solo lo carga el explorador).
 */
export async function leerDatos<T>(archivo: string): Promise<T> {
  const p = path.join(process.cwd(), "public", "data", archivo);
  return JSON.parse(await fs.readFile(p, "utf-8")) as T;
}
