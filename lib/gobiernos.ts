/**
 * Períodos constitucionales de la Gobernación del Archipiélago.
 *
 * En Colombia los gobernadores se eligen por cuatro años (Constitución, art. 303,
 * modificado por el Acto Legislativo 2 de 2002) y se posesionan el 1 de enero del
 * año siguiente a la elección; el período va hasta el 31 de diciembre del cuarto
 * año (para 2024-2027 lo confirma la Ley 2200 de 2022). Las elecciones regionales
 * se celebran el último domingo de octubre del año anterior.
 *
 * El filtro usa esas fechas legales, no la permanencia real de cada persona: en
 * este departamento casi ningún gobernador completó su período. Los titulares se
 * listan como contexto, con el rol con el que ejercieron.
 */

export type Rol = "elegido" | "encargado";

export interface Gobernante {
  nombre: string;
  rol: Rol;
  nota?: string;
}

export interface Periodo {
  id: string;
  /** primer día del período constitucional (posesión) */
  desde: string;
  /** último día del período constitucional */
  hasta: string;
  /** elección regional que lo originó */
  eleccion: string;
  gobernantes: Gobernante[];
  /** true si el período tuvo suspensiones, encargos o anulación de la elección */
  interrumpido: boolean;
}

export const PERIODOS: Periodo[] = [
  {
    id: "2012-2015",
    desde: "2012-01-01", hasta: "2015-12-31", eleccion: "2011-10-30",
    interrumpido: false,
    gobernantes: [
      { nombre: "Aury Socorro Guerrero Bowie", rol: "elegido",
        nota: "Primera gobernadora del archipiélago elegida por voto popular." },
    ],
  },
  {
    id: "2016-2019",
    desde: "2016-01-01", hasta: "2019-12-31", eleccion: "2015-10-25",
    interrumpido: true,
    gobernantes: [
      { nombre: "Ronald Housni Jaller", rol: "elegido",
        nota: "Suspendido el 23 de abril de 2018. Condenado por corrupción en contratación." },
      { nombre: "Sandra Victoria Howard Taylor", rol: "encargado",
        nota: "Gobernadora encargada tras la suspensión de Housni (abril-julio de 2018)." },
    ],
  },
  {
    id: "2020-2023",
    desde: "2020-01-01", hasta: "2023-12-31", eleccion: "2019-10-27",
    interrumpido: true,
    gobernantes: [
      { nombre: "Everth Julio Hawkins Sjogreen", rol: "elegido",
        nota: "Suspendido en septiembre de 2020 con detención domiciliaria; recobró la libertad el 22 de abril de 2021." },
      { nombre: "Alen Jay Stephens", rol: "encargado",
        nota: "Gobernador encargado durante la suspensión de Hawkins." },
    ],
  },
  {
    id: "2024-2027",
    desde: "2024-01-01", hasta: "2027-12-31", eleccion: "2023-10-29",
    interrumpido: true,
    gobernantes: [
      { nombre: "Nicolás Iván Gallardo Vásquez", rol: "elegido",
        nota: "Elección anulada por el Consejo de Estado por doble militancia." },
      { nombre: "Vilma Jay López", rol: "encargado",
        nota: "Designada por la Presidencia mientras se organizaba la elección atípica (Decreto 0471 del 7 de mayo de 2026)." },
      { nombre: "Girley Natacha Ordóñez Bowie", rol: "elegido",
        nota: "Elegida en la elección atípica del 5 de julio de 2026." },
    ],
  },
];

/** Períodos que se solapan con el rango de datos disponible. */
export function periodosConDatos(desde: string, hasta: string): Periodo[] {
  return PERIODOS.filter((p) => p.desde <= hasta && p.hasta >= desde);
}

export const periodoPorId = (id: string) => PERIODOS.find((p) => p.id === id) ?? null;

/** Etiqueta corta: "2020 – 2023". */
export const etiquetaPeriodo = (p: Periodo) =>
  `${p.desde.slice(0, 4)} – ${p.hasta.slice(0, 4)}`;

/** Nombre del titular electo, para identificar el período de un vistazo. */
export const titular = (p: Periodo) =>
  p.gobernantes.find((g) => g.rol === "elegido")?.nombre ?? p.gobernantes[0]?.nombre ?? "";
