import type { FeatureCollection } from "geojson";
import type { Contrato, ContratosRaw, Meta } from "./types";

/** Quita tildes y pasa a minúscula, para búsquedas tolerantes. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function decodificar(raw: ContratosRaw): Contrato[] {
  const { dic, filas } = raw;
  return filas.map((f, i) => {
    const objeto = f[11] as string;
    const proveedor = dic.proveedor[f[7] as number];
    const ref = f[1] as string;
    const documento = f[8] as string;
    const bi = f[13] as number;
    const barrio = bi >= 0 ? dic.barrio[bi] : null;
    const domicilio = f[14] as string;
    return {
      i,
      id: f[0] as string,
      ref,
      estado: dic.estado[f[2] as number],
      tipo: dic.tipo[f[3] as number],
      modalidad: dic.modalidad[f[4] as number],
      firma: f[5] as string,
      fin: f[6] as string,
      proveedor,
      documento,
      valor: f[9] as number,
      pagado: f[10] as number,
      objeto,
      duracion: f[12] as string,
      barrio,
      domicilio,
      origen: dic.origen[f[15] as number],
      destino: dic.destino[f[16] as number],
      notice: f[17] as string,
      // el índice incluye barrio y domicilio para que "loma" o "san luis" también busquen
      busq: normalizar(`${objeto} ${proveedor} ${ref} ${documento} ${barrio ?? ""} ${domicilio}`),
    };
  });
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${r.status})`);
  return r.json() as Promise<T>;
}

export async function cargarTodo() {
  const [raw, meta, isla, barrios] = await Promise.all([
    json<ContratosRaw>("/data/contratos.json"),
    json<Meta>("/data/meta.json"),
    json<FeatureCollection>("/data/isla.geojson"),
    json<FeatureCollection>("/data/barrios.json"),
  ]);
  return { contratos: decodificar(raw), meta, isla, barrios };
}
