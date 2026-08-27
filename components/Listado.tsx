"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Contrato } from "@/lib/types";
import { normalizar } from "@/lib/data";
import { cop, copCorto, fecha, numero } from "@/lib/format";
import { Chip } from "./ui";
import { etiquetaPeriodo, periodoPorId, periodosConDatos, titular } from "@/lib/gobiernos";
import { FILTROS_VACIOS, type Filtros, type Orden } from "@/lib/urlEstado";
import Compartir from "./Compartir";

const ALTO = 104;      // alto fijo por fila: habilita virtualización simple
const COLCHON = 6;     // filas extra arriba y abajo

const ORDENES: [Orden, string][] = [
  ["firma-desc", "Más recientes"],
  ["firma-asc", "Más antiguos"],
  ["valor-desc", "Mayor valor"],
  ["valor-asc", "Menor valor"],
];

type Pred = (c: Contrato) => boolean;

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

function Selector({ etiqueta, valor, onChange, opciones }: {
  etiqueta: string; valor: string; onChange: (v: string) => void;
  opciones: [string, number][];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {etiqueta}
      </span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-lg border px-2 py-1.5 text-xs"
        style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
        <option value="">Todos</option>
        {opciones.map(([v, n]) => (
          <option key={v} value={v}>{v} ({numero(n)})</option>
        ))}
      </select>
    </label>
  );
}

export default function Listado({
  contratos, filtros, setFiltros, urlCompartir, onAbrirContrato,
}: {
  contratos: Contrato[];
  /** el estado vive en la página, que lo sincroniza con la URL */
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  urlCompartir: string;
  onAbrirContrato: (c: Contrato) => void;
}) {
  const { q, gobierno, fuente, estado, tipo, modalidad,
          barrio, desde, hasta, minValor, orden } = filtros;

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros({ ...filtros, [k]: v });

  const setQ = (v: string) => set("q", v);
  const setFuente = (v: string) => set("fuente", v);
  const setEstado = (v: string) => set("estado", v);
  const setTipo = (v: string) => set("tipo", v);
  const setModalidad = (v: string) => set("modalidad", v);
  const setBarrio = (v: string) => set("barrio", v);
  const setMinValor = (v: string) => set("minValor", v);
  const setOrden = (v: Orden) => set("orden", v);

  const qd = useDeferredValue(q);

  const rango = useMemo(() => {
    const fs = contratos.map((c) => c.firma).filter(Boolean).sort();
    return { min: fs[0] ?? "", max: fs[fs.length - 1] ?? "" };
  }, [contratos]);
  const periodos = useMemo(() => periodosConDatos(rango.min, rango.max), [rango]);
  const periodoSel = gobierno ? periodoPorId(gobierno) : null;

  /** Elegir un gobierno fija las fechas a su período constitucional. */
  function elegirGobierno(id: string) {
    const p = id ? periodoPorId(id) : null;
    setFiltros({ ...filtros, gobierno: id, desde: p ? p.desde : "", hasta: p ? p.hasta : "" });
  }

  /** Editar una fecha a mano deja de corresponder a un período: se desmarca. */
  const setDesdeManual = (v: string) => setFiltros({ ...filtros, gobierno: "", desde: v });
  const setHastaManual = (v: string) => setFiltros({ ...filtros, gobierno: "", hasta: v });

  /** Un predicado por dimensión activa; las inactivas no entran. */
  const preds = useMemo(() => {
    const p: Record<string, Pred> = {};
    if (fuente) p.fuente = (c) => c.fuente === fuente;
    if (estado) p.estado = (c) => c.estado === estado;
    if (tipo) p.tipo = (c) => c.tipo === tipo;
    if (modalidad) p.modalidad = (c) => c.modalidad === modalidad;
    if (barrio) p.barrio = (c) => c.barrio === barrio;
    if (desde || hasta) {
      p.fechas = (c) => (!desde || c.firma >= desde) && (!hasta || c.firma <= hasta);
    }
    const min = minValor ? Number(minValor) : 0;
    if (min) p.valor = (c) => c.valor >= min;
    // varias palabras = AND, así "profesional loma" acota de verdad
    const terminos = normalizar(qd).split(/\s+/).filter(Boolean);
    if (terminos.length) p.q = (c) => terminos.every((t) => c.busq.includes(t));
    return p;
  }, [qd, fuente, estado, tipo, modalidad, barrio, desde, hasta, minValor]);

  /** Contratos por período, ignorando el propio filtro de fechas. */
  const conteoPeriodos = useMemo(() => {
    const otros = Object.entries(preds).filter(([k]) => k !== "fechas").map(([, f]) => f);
    const m = new Map<string, number>();
    for (const c of contratos) {
      let ok = true;
      for (const f of otros) if (!f(c)) { ok = false; break; }
      if (!ok) continue;
      const p = periodos.find((x) => c.firma >= x.desde && c.firma <= x.hasta);
      if (p) m.set(p.id, (m.get(p.id) ?? 0) + 1);
    }
    return m;
  }, [contratos, preds, periodos]);

  const opciones = useMemo(() => ({
    fuente: faceta(contratos, preds, "fuente", (c) => c.fuente, fuente),
    estado: faceta(contratos, preds, "estado", (c) => c.estado, estado),
    tipo: faceta(contratos, preds, "tipo", (c) => c.tipo, tipo),
    modalidad: faceta(contratos, preds, "modalidad", (c) => c.modalidad, modalidad),
    barrio: faceta(contratos, preds, "barrio", (c) => c.barrio, barrio),
  }), [contratos, preds, fuente, estado, tipo, modalidad, barrio]);

  const filtrados = useMemo(() => {
    const fs = Object.values(preds);
    const out = contratos.filter((c) => fs.every((f) => f(c)));
    const cmp: Record<Orden, (a: Contrato, b: Contrato) => number> = {
      "firma-desc": (a, b) => (a.firma < b.firma ? 1 : a.firma > b.firma ? -1 : 0),
      "firma-asc": (a, b) => (a.firma > b.firma ? 1 : a.firma < b.firma ? -1 : 0),
      "valor-desc": (a, b) => b.valor - a.valor,
      "valor-asc": (a, b) => a.valor - b.valor,
    };
    return out.sort(cmp[orden]);
  }, [contratos, preds, orden]);

  const total = useMemo(() => filtrados.reduce((s, c) => s + c.valor, 0), [filtrados]);

  // --- virtualización ---
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [alto, setAlto] = useState(600);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAlto(el.clientHeight));
    ro.observe(el);
    setAlto(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); setScrollTop(0); },
    [qd, fuente, estado, tipo, modalidad, barrio, desde, hasta, minValor, orden]);

  const primera = Math.max(0, Math.floor(scrollTop / ALTO) - COLCHON);
  const ultima = Math.min(filtrados.length, Math.ceil((scrollTop + alto) / ALTO) + COLCHON);
  const visibles = filtrados.slice(primera, ultima);

  const limpiar = () => setFiltros({ ...FILTROS_VACIOS, orden });
  const hayFiltro = q || gobierno || fuente || estado || tipo || modalidad || barrio || desde || hasta || minValor;

  return (
    <div className="flex h-[82vh] min-h-[560px] flex-col gap-3">
      {/* buscador */}
      <div className="rounded-xl border p-3"
           style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="relative">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en objeto, proveedor, documento, barrio o domicilio…"
            className="w-full rounded-lg border px-3 py-2.5 pr-20 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--line)", background: "var(--raised)", color: "var(--ink)" }}
          />
          {q && (
            <button onClick={() => setQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs"
                    style={{ color: "var(--muted)" }}>limpiar</button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-9">
          <Selector etiqueta="Fuente" valor={fuente} onChange={setFuente} opciones={opciones.fuente} />
          <Selector etiqueta="Estado" valor={estado} onChange={setEstado} opciones={opciones.estado} />
          <Selector etiqueta="Tipo" valor={tipo} onChange={setTipo} opciones={opciones.tipo} />
          <Selector etiqueta="Modalidad" valor={modalidad} onChange={setModalidad} opciones={opciones.modalidad} />
          <Selector etiqueta="Barrio" valor={barrio} onChange={setBarrio} opciones={opciones.barrio} />
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Gobierno</span>
            <select value={gobierno} onChange={(e) => elegirGobierno(e.target.value)}
                    className="w-full truncate rounded-lg border px-2 py-1.5 text-xs"
                    style={{ borderColor: gobierno ? "var(--accent)" : "var(--line)",
                             background: "var(--surface)", color: "var(--ink)" }}>
              <option value="">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {etiquetaPeriodo(p)} · {titular(p)} ({numero(conteoPeriodos.get(p.id) ?? 0)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Firmado desde</span>
            <input type="date" value={desde} onChange={(e) => setDesdeManual(e.target.value)}
                   className="rounded-lg border px-2 py-1.5 text-xs"
                   style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHastaManual(e.target.value)}
                   className="rounded-lg border px-2 py-1.5 text-xs"
                   style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Valor mínimo</span>
            <input type="number" inputMode="numeric" value={minValor} placeholder="0"
                   onChange={(e) => setMinValor(e.target.value)}
                   className="num rounded-lg border px-2 py-1.5 text-xs"
                   style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
          </label>
        </div>
      </div>

      {periodoSel && (
        <div className="rounded-xl border px-3.5 py-3"
             style={{ borderColor: "var(--accent)", background: "var(--surface)" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Período constitucional {etiquetaPeriodo(periodoSel)}
            </h3>
            <span className="num text-[11px]" style={{ color: "var(--muted)" }}>
              {fecha(periodoSel.desde)} — {fecha(periodoSel.hasta)} · elección del{" "}
              {fecha(periodoSel.eleccion)}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {periodoSel.gobernantes.map((g) => (
              <li key={g.nombre} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                <Chip tono={g.rol === "elegido" ? "ok" : "neutro"}>{g.rol}</Chip>
                <span className="font-medium">{g.nombre}</span>
                {g.nota && (
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{g.nota}</span>
                )}
              </li>
            ))}
          </ul>
          {periodoSel.interrumpido && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--sand)" }}>
              El filtro usa las fechas legales del período, no la permanencia real de cada
              persona: dentro de este período hubo suspensiones o encargos, así que los
              contratos no corresponden todos al mismo gobernante.
            </p>
          )}
        </div>
      )}

      {/* barra de resultados */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
          <strong className="num text-sm">{numero(filtrados.length)}</strong>
          <span>de {numero(contratos.length)} contratos</span>
          <span style={{ color: "var(--line)" }}>·</span>
          <span className="num" style={{ color: "var(--accent)" }}>{copCorto(total)}</span>
          {hayFiltro && (
            <button onClick={limpiar} className="ml-1 rounded-md border px-2 py-0.5"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
              quitar filtros
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Compartir url={urlCompartir} etiqueta="Compartir búsqueda"
                     titulo="Copia un enlace que abre esta misma búsqueda con sus filtros" />
        <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}
                className="rounded-lg border px-2 py-1 text-xs"
                style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
          {ORDENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        </div>
      </div>

      {/* lista virtualizada */}
      <div ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
           className="flex-1 overflow-y-auto rounded-xl border"
           style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        {filtrados.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm"
               style={{ color: "var(--muted)" }}>
            Ningún contrato coincide con la búsqueda.
          </div>
        ) : (
          <div style={{ height: filtrados.length * ALTO, position: "relative" }}>
            <div style={{ transform: `translateY(${primera * ALTO}px)` }}>
              {visibles.map((c) => (
                <button key={c.id} onClick={() => onAbrirContrato(c)}
                        className="flex w-full flex-col justify-center gap-1 border-b px-4 text-left transition hover:bg-[var(--raised)]"
                        style={{ height: ALTO, borderColor: "var(--line-soft)" }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{c.proveedor}</span>
                    <span className="num shrink-0 text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      {cop(c.valor)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-snug" style={{ color: "var(--ink-soft)" }}>
                    {c.objeto}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tono={c.estado === "En ejecución" ? "ok" : "neutro"}>{c.estado}</Chip>
                    {c.duracion && <Chip>{c.duracion}</Chip>}
                    <Chip>{c.destino}</Chip>
                    {c.barrio && <Chip>{c.barrio}</Chip>}
                    {c.fuente === "SECOP I" && <Chip tono="alerta">SECOP I</Chip>}
                    <span className="num text-[11px]" style={{ color: "var(--muted)" }}>
                      {fecha(c.firma)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
