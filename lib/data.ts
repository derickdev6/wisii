import type { FeatureCollection } from "geojson";
import type { Contrato, ContratosRaw, Meta } from "./types";

/** Quita tildes y pasa a minúscula, para búsquedas tolerantes. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function decodificar(raw: ContratosRaw): Contrato[] {
  const { dic, filas, pref, prefEnlace } = raw;
  return filas.map((f, i) => {
    const fuente = dic.fuente[f[1] as number] as Contrato["fuente"];
    const id = (pref[fuente] ?? "") + (f[0] as string);
    const entidad = dic.entidad[f[2] as number];
    const objeto = dic.objeto[f[12] as number];
    const proveedor = dic.proveedor[f[8] as number];
    const documento = f[9] as string;
    const bi = f[14] as number;
    const barrio = bi >= 0 ? dic.barrio[bi] : null;
    const domicilio = dic.domicilio[f[15] as number];
    const enlace = f[18] as string;
    return {
      i,
      id,
      fuente,
      entidad,
      estado: dic.estado[f[3] as number],
      tipo: dic.tipo[f[4] as number],
      modalidad: dic.modalidad[f[5] as number],
      firma: dic.firma[f[6] as number],
      fin: dic.fin[f[7] as number],
      proveedor,
      documento,
      valor: f[10] as number,
      pagado: f[11] as number,
      objeto,
      duracion: dic.duracion[f[13] as number],
      barrio,
      domicilio,
      origen: dic.origen[f[16] as number],
      destino: dic.destino[f[17] as number],
      enlace: enlace ? (prefEnlace[fuente] ?? "") + enlace : "",
      // el índice incluye entidad, barrio y domicilio para que la búsqueda sea integral
      busq: normalizar(
        `${objeto} ${proveedor} ${entidad} ${id} ${documento} ${barrio ?? ""} ${domicilio}`),
    };
  });
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${r.status})`);
  return r.json() as Promise<T>;
}

export async function cargarTodo() {
  const [raw, meta, islas, barrios] = await Promise.all([
    json<ContratosRaw>("/data/contratos.json"),
    json<Meta>("/data/meta.json"),
    json<FeatureCollection>("/data/islas.geojson"),
    json<FeatureCollection>("/data/barrios.json"),
  ]);
  return { contratos: decodificar(raw), meta, islas, barrios };
}
