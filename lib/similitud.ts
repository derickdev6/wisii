/**
 * Sugerencias de barrio por parecido de nombre.
 *
 * Los domicilios sin reconocer suelen ser direcciones completas con el barrio
 * mal escrito adentro ("EL BAIGTH MZ 5 CASA 18" es El Bight). Por eso la
 * comparación es por palabras y no sobre la cadena entera: se busca la palabra
 * del texto que más se parezca a cada palabra del barrio.
 *
 * Se combinan dos medidas porque fallan en casos distintos:
 *  - Dice sobre trigramas capta bien inserciones y sufijos, pero se cae con
 *    transposiciones: BAIGTH y BIGHT no comparten ni un trigrama.
 *  - Levenshtein normalizado sí las capta.
 * Se toma la mayor de las dos.
 */

/** Palabras de dirección que nunca son el nombre del barrio. */
const RUIDO = new Set([
  "CALLE", "CARRERA", "CRA", "KR", "AV", "AVENIDA", "DIAGONAL", "TRANSVERSAL",
  "MZ", "MANZANA", "CASA", "APTO", "APARTAMENTO", "EDIFICIO", "EDIF", "LOTE",
  "PISO", "BLOQUE", "TORRE", "ETAPA", "INTERIOR", "INT", "NO", "NRO", "KM",
  "BARRIO", "SECTOR", "VIA", "DEL", "DE", "LA", "EL", "LOS", "LAS", "Y",
  "SAN", "ANDRES", "ISLA", "ISLAS", "COLOMBIA", "PROVIDENCIA", "FRENTE",
  "DETRAS", "LADO", "ENTRADA", "PARTE", "TIENDA", "CERCA",
]);

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Palabras útiles: sin ruido de dirección, sin números, de 3 letras o más. */
function palabras(s: string): string[] {
  return normalizar(s).split(" ")
    .filter((p) => p.length >= 3 && !/^\d+$/.test(p) && !RUIDO.has(p));
}

function trigramas(s: string): Set<string> {
  const t = new Set<string>();
  const p = `  ${s} `;
  for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
  return t;
}

function dice(a: string, b: string): number {
  const A = trigramas(a), B = trigramas(b);
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const g of A) if (B.has(g)) comunes++;
  return (2 * comunes) / (A.size + B.size);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(
        prev[j] + 1,
        fila[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = fila;
  }
  return prev[b.length];
}

/** Parecido entre dos palabras, de 0 a 1. */
function simPalabra(a: string, b: string): number {
  if (a === b) return 1;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return Math.max(dice(a, b), lev);
}

export interface Sugerencia {
  barrio: string;
  puntaje: number;
  /** true si el nombre aparece literalmente dentro del texto */
  literal: boolean;
}

/**
 * Ordena los barrios por cuánto se parecen al texto. El puntaje pondera cada
 * palabra del barrio por su longitud, para que "Hill" no pese lo mismo que
 * "Schooner" en "Schooner Bight".
 */
export function sugerir(
  texto: string, barrios: string[], cuantas = 8,
): Sugerencia[] {
  const norm = normalizar(texto);
  const delTexto = palabras(texto);

  const out = barrios.map((barrio): Sugerencia => {
    const nb = normalizar(barrio);
    // coincidencia literal con límite de palabra: es lo que hará el matcher
    const literal = new RegExp(`(?<![A-Z0-9])${nb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Z0-9])`).test(norm);
    if (literal) return { barrio, puntaje: 1, literal: true };

    const delBarrio = palabras(barrio);
    if (!delBarrio.length || !delTexto.length) return { barrio, puntaje: 0, literal: false };

    let suma = 0, peso = 0;
    for (const pb of delBarrio) {
      let mejor = 0;
      for (const pt of delTexto) mejor = Math.max(mejor, simPalabra(pb, pt));
      suma += mejor * pb.length;
      peso += pb.length;
    }
    return { barrio, puntaje: peso ? suma / peso : 0, literal: false };
  });

  return out
    .filter((s) => s.puntaje >= 0.45)
    // Entre coincidencias literales gana la más larga, que es exactamente el
    // criterio del matcher de build_data.py: alias más específico primero.
    .sort((a, b) =>
      Number(b.literal) - Number(a.literal) ||
      (a.literal && b.literal ? b.barrio.length - a.barrio.length : 0) ||
      b.puntaje - a.puntaje ||
      a.barrio.localeCompare(b.barrio))
    .slice(0, cuantas);
}
