/**
 * Estado del explorador serializado en la URL, para que una búsqueda con
 * filtros —o un contrato puntual— se pueda compartir tal cual.
 *
 * Las claves son cortas a propósito: el enlace se pega en WhatsApp y se lee.
 * Los valores vacíos no se escriben, así una búsqueda sin filtros deja la URL
 * limpia.
 */

export type Orden = "firma-desc" | "firma-asc" | "valor-desc" | "valor-asc";
export type Vista = "mapa" | "contratos" | "editor";

export interface Filtros {
  q: string;
  gobierno: string;
  fuente: string;
  estado: string;
  tipo: string;
  modalidad: string;
  barrio: string;
  desde: string;
  hasta: string;
  minValor: string;
  orden: Orden;
}

export const FILTROS_VACIOS: Filtros = {
  q: "", gobierno: "", fuente: "", estado: "", tipo: "", modalidad: "",
  barrio: "", desde: "", hasta: "", minValor: "", orden: "firma-desc",
};

/** nombre del campo -> parámetro en la URL */
const CLAVES: Record<keyof Filtros, string> = {
  q: "q", gobierno: "gob", fuente: "fuente", estado: "estado", tipo: "tipo",
  modalidad: "modalidad", barrio: "barrio", desde: "desde", hasta: "hasta",
  minValor: "min", orden: "orden",
};

const VISTAS: Vista[] = ["mapa", "contratos", "editor"];
const ORDENES: Orden[] = ["firma-desc", "firma-asc", "valor-desc", "valor-asc"];

export function leerFiltros(sp: URLSearchParams): Filtros {
  const f = { ...FILTROS_VACIOS };
  for (const [campo, clave] of Object.entries(CLAVES) as [keyof Filtros, string][]) {
    const v = sp.get(clave);
    if (v) (f as Record<string, string>)[campo] = v;
  }
  if (!ORDENES.includes(f.orden)) f.orden = FILTROS_VACIOS.orden;
  return f;
}

export function leerVista(sp: URLSearchParams): Vista {
  const v = sp.get("v") as Vista | null;
  if (v && VISTAS.includes(v)) return v;
  // un enlace a un contrato sin vista explícita abre el listado, no el mapa
  return sp.get("c") ? "contratos" : "mapa";
}

export const leerContrato = (sp: URLSearchParams) => sp.get("c") ?? null;

/** Construye el query string; omite lo que esté en su valor por defecto. */
export function escribirUrl(
  vista: Vista, filtros: Filtros, contrato: string | null,
): string {
  const sp = new URLSearchParams();
  if (vista !== "mapa") sp.set("v", vista);
  for (const [campo, clave] of Object.entries(CLAVES) as [keyof Filtros, string][]) {
    const v = filtros[campo];
    if (v && v !== FILTROS_VACIOS[campo]) sp.set(clave, v);
  }
  if (contrato) sp.set("c", contrato);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const hayFiltros = (f: Filtros) =>
  (Object.keys(FILTROS_VACIOS) as (keyof Filtros)[])
    .some((k) => f[k] && f[k] !== FILTROS_VACIOS[k]);
