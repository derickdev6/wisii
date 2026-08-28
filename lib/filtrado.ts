"use client";

import { useMemo } from "react";
import type { Contrato } from "./types";
import { normalizar } from "./data";
import { periodosConDatos, type Periodo } from "./gobiernos";
import type { Filtros, Orden } from "./urlEstado";

export type Pred = (c: Contrato) => boolean;

/**
 * Cuenta los valores de una faceta sobre los contratos que pasan todos los
 * filtros MENOS el suyo. Así, al elegir un gobierno, los demás selectores
 * muestran cuántos contratos hay dentro de ese período y no en el total.
 * El valor ya elegido se conserva aunque quede en cero, para que el <select>
 * no aparezca vacío.
 */
function faceta(
  cs: Contrato[], preds: Record<string, Pred>, dim: string,
  clave: (c: Contrato) => string | null, elegido: string,
): [string, number][] {
  const otros = Object.entries(preds).filter(([k]) => k !== dim).map(([, f]) => f);
  const m = new Map<string, number>();
  for (const c of cs) {
    let ok = true;
    for (const f of otros) if (!f(c)) { ok = false; break; }
    if (!ok) continue;
    const v = clave(c);
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  if (elegido && !m.has(elegido)) m.set(elegido, 0);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const COMPARADORES: Record<Orden, (a: Contrato, b: Contrato) => number> = {
  "firma-desc": (a, b) => (a.firma < b.firma ? 1 : a.firma > b.firma ? -1 : 0),
  "firma-asc": (a, b) => (a.firma > b.firma ? 1 : a.firma < b.firma ? -1 : 0),
  "valor-desc": (a, b) => b.valor - a.valor,
  "valor-asc": (a, b) => a.valor - b.valor,
};

export interface Filtrado {
  filtrados: Contrato[];
  total: number;
  opciones: Record<"entidad" | "estado" | "tipo" | "modalidad", [string, number][]>;
  periodos: Periodo[];
  conteoPeriodos: Map<string, number>;
}

/**
 * Filtrado compartido por el listado y el mapa de calor: las dos vistas miran
 * exactamente el mismo subconjunto.
 *
 * `omitirBusqueda` sirve para el mapa, cuya barra no incluye el buscador de
 * texto; sin esto, una búsqueda escrita en el listado seguiría acotando el
 * mapa sin que se vea por qué.
 */
export function useFiltrado(
  contratos: Contrato[], f: Filtros, omitirBusqueda = false,
): Filtrado {
  const preds = useMemo(() => {
    const p: Record<string, Pred> = {};
    if (f.entidad) p.entidad = (c) => c.entidad === f.entidad;
    if (f.estado) p.estado = (c) => c.estado === f.estado;
    if (f.tipo) p.tipo = (c) => c.tipo === f.tipo;
    if (f.modalidad) p.modalidad = (c) => c.modalidad === f.modalidad;
    if (f.desde || f.hasta) {
      p.fechas = (c) => (!f.desde || c.firma >= f.desde) && (!f.hasta || c.firma <= f.hasta);
    }
    const min = f.minValor ? Number(f.minValor) : 0;
    if (min) p.valor = (c) => c.valor >= min;
    if (!omitirBusqueda) {
      // varias palabras = AND, así "profesional loma" acota de verdad
      const terminos = normalizar(f.q).split(/\s+/).filter(Boolean);
      if (terminos.length) p.q = (c) => terminos.every((t) => c.busq.includes(t));
    }
    return p;
  }, [f.q, f.entidad, f.estado, f.tipo, f.modalidad, f.desde, f.hasta,
      f.minValor, omitirBusqueda]);

  const filtrados = useMemo(() => {
    const fs = Object.values(preds);
    return contratos.filter((c) => fs.every((p) => p(c))).sort(COMPARADORES[f.orden]);
  }, [contratos, preds, f.orden]);

  const opciones = useMemo(() => ({
    entidad: faceta(contratos, preds, "entidad", (c) => c.entidad, f.entidad),
    estado: faceta(contratos, preds, "estado", (c) => c.estado, f.estado),
    tipo: faceta(contratos, preds, "tipo", (c) => c.tipo, f.tipo),
    modalidad: faceta(contratos, preds, "modalidad", (c) => c.modalidad, f.modalidad),
  }), [contratos, preds, f.entidad, f.estado, f.tipo, f.modalidad]);

  const periodos = useMemo(() => {
    const fs = contratos.map((c) => c.firma).filter(Boolean).sort();
    return periodosConDatos(fs[0] ?? "", fs[fs.length - 1] ?? "");
  }, [contratos]);

  /** Contratos por período, ignorando el propio filtro de fechas. */
  const conteoPeriodos = useMemo(() => {
    const otros = Object.entries(preds).filter(([k]) => k !== "fechas").map(([, p]) => p);
    const m = new Map<string, number>();
    for (const c of contratos) {
      let ok = true;
      for (const p of otros) if (!p(c)) { ok = false; break; }
      if (!ok) continue;
      const per = periodos.find((x) => c.firma >= x.desde && c.firma <= x.hasta);
      if (per) m.set(per.id, (m.get(per.id) ?? 0) + 1);
    }
    return m;
  }, [contratos, preds, periodos]);

  const total = useMemo(() => filtrados.reduce((s, c) => s + c.valor, 0), [filtrados]);

  return { filtrados, total, opciones, periodos, conteoPeriodos };
}
