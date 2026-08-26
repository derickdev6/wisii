/** Formato del archivo public/data/contratos.json (codificado con diccionarios). */
export interface ContratosRaw {
  campos: string[];
  /** prefijo constante de id recortado de cada fila, por fuente */
  pref: Record<string, string>;
  dic: {
    fuente: string[]; estado: string[]; tipo: string[]; modalidad: string[];
    proveedor: string[]; origen: string[]; destino: string[]; barrio: string[];
    objeto: string[]; duracion: string[]; domicilio: string[];
  };
  filas: (string | number)[][];
}

/** Una fila ya decodificada. */
export type Fuente = "SECOP II" | "SECOP I";

export interface Contrato {
  i: number;
  id: string;
  /** SECOP I no publica domicilio del contratista: nunca tiene barrio */
  fuente: Fuente;
  estado: string;
  tipo: string;
  modalidad: string;
  firma: string;
  fin: string;
  proveedor: string;
  documento: string;
  valor: number;
  pagado: number;
  objeto: string;
  duracion: string;
  barrio: string | null;
  domicilio: string;
  origen: string;
  destino: string;
  enlace: string;
  /** objeto + proveedor + ref + documento, normalizado, para la búsqueda */
  busq: string;
}

export interface Meta {
  actualizado: string;
  entidad: string;
  nit: string;
  fuente: string;
  contratos: number;
  por_fuente: Record<string, number>;
  duplicados_descartados: number;
  valor_total: number;
  valor_mediano: number;
  valor_pagado: number;
  /** contratos con valor_pagado > 0; en este dataset es casi cero */
  con_pago_reportado: number;
  proveedores: number;
  desde: string;
  hasta: string;
  por_mes: Record<string, number>;
  geo: {
    con_barrio: number;
    /** contratos que traen el campo domicilio (solo SECOP II) */
    mapeables: number;
    cobertura_total: number; sin_dato: number; no_reconocido: number;
    cobertura: number; barrios_ubicados: number; barrios_aprox: number;
  };
  /** domicilios que ningún alias reconoce; insumo del editor de barrios */
  pendientes: { texto: string; n: number }[];
  /** nº de contratos por barrio, para priorizar en el editor */
  por_barrio: Record<string, number>;
}

export interface BarrioFeature {
  type: "Feature";
  properties: { barrio: string; n: number; valor: number; src: "osm-place" | "aprox" };
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface Gazetteer {
  _nota?: string;
  barrios: Record<string, { lat: number; lon: number; src: string }>;
  alias: Record<string, string>;
}
