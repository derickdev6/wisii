"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contrato } from "@/lib/types";
import { cop, copCorto, fecha, numero } from "@/lib/format";
import { Chip } from "./ui";
import Compartir from "./Compartir";
import type { Filtros, Orden } from "@/lib/urlEstado";

const ORDENES: [Orden, string][] = [
  ["firma-desc", "Más recientes"],
  ["firma-asc", "Más antiguos"],
  ["valor-desc", "Mayor valor"],
  ["valor-asc", "Menor valor"],
];

const TAMANOS = [10, 20, 50, 100];
const POR_PAGINA_INICIAL = 20;

/** Tope de alto de la caja de resultados: con pocas filas se encoge hasta su
 *  contenido, y solo aparece scroll interno cuando lo supera. */
const ALTO_MAX_CAJA = 800;

function Fila({ c, onAbrir }: { c: Contrato; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir}
            className="flex w-full flex-col gap-1.5 border-b px-4 py-3 text-left transition hover:bg-[var(--raised)]"
            style={{ borderColor: "var(--line-soft)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">{c.proveedor}</span>
        <span className="num shrink-0 text-sm font-semibold" style={{ color: "var(--cta)" }}>
          {cop(c.valor)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs leading-snug" style={{ color: "var(--ink-soft)" }}>
        {c.objeto}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>{c.entidad}</Chip>
        <Chip tono={c.estado === "En ejecución" ? "ok" : "neutro"}>{c.estado}</Chip>
        {c.duracion && <Chip>{c.duracion}</Chip>}
        <Chip>{c.destino}</Chip>
        {c.barrio && <Chip>{c.barrio}</Chip>}
        {c.fuente === "SECOP I" && <Chip tono="alerta">SECOP I</Chip>}
        <span className="num text-[11px]" style={{ color: "var(--muted)" }}>{fecha(c.firma)}</span>
      </div>
    </button>
  );
}

export default function Listado({
  filtrados, total, universo, filtros, setFiltros, urlCompartir, onAbrirContrato,
}: {
  filtrados: Contrato[];
  total: number;
  /** tamaño del conjunto sin filtrar, para el "N de M" */
  universo: number;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  urlCompartir: string;
  onAbrirContrato: (c: Contrato) => void;
}) {
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const [pagina, setPagina] = useState(1);

  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));

  // cualquier cambio en el resultado devuelve a la primera página y al tope
  useEffect(() => { setPagina(1); caja.current?.scrollTo({ top: 0 }); }, [filtrados, porPagina]);

  const visibles = useMemo(
    () => filtrados.slice((pagina - 1) * porPagina, pagina * porPagina),
    [filtrados, pagina, porPagina]);

  const caja = useRef<HTMLDivElement>(null);
  const irA = (p: number) => {
    setPagina(Math.min(paginas, Math.max(1, p)));
    caja.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* barra de resultados */}
      <div id="lista" className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-2" style={{ color: "var(--ink-soft)" }}>
          <strong className="num text-sm">{numero(filtrados.length)}</strong>
          <span>de {numero(universo)} contratos</span>
          <span style={{ color: "var(--line)" }}>·</span>
          <span className="num font-semibold" style={{ color: "var(--cta)" }}>{copCorto(total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Compartir url={urlCompartir} etiqueta="Compartir búsqueda"
                     titulo="Copia un enlace que abre esta misma búsqueda con sus filtros" />
          <select value={filtros.orden}
                  onChange={(e) => setFiltros({ ...filtros, orden: e.target.value as Orden })}
                  className="rounded-lg border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
            {ORDENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* la caja se ajusta al contenido hasta el tope, y ahí scrollea */}
      <div ref={caja} className="overflow-y-auto overscroll-contain rounded-xl border"
           style={{ maxHeight: ALTO_MAX_CAJA, borderColor: "var(--line)",
                    background: "var(--surface)" }}>
        {visibles.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
            Ningún contrato coincide con la búsqueda.
          </div>
        ) : (
          visibles.map((c) => (
            <Fila key={c.id} c={c} onAbrir={() => onAbrirContrato(c)} />
          ))
        )}
      </div>

      {/* paginación */}
      {filtrados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
          <label className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
            Por página
            <select value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))}
                    className="rounded-lg border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
              {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <div className="flex items-center gap-1.5">
            <button onClick={() => irA(pagina - 1)} disabled={pagina === 1}
                    className="rounded-md border px-2.5 py-1 disabled:opacity-35"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              ← Anterior
            </button>
            <span className="num px-2" style={{ color: "var(--muted)" }}>
              {numero(pagina)} / {numero(paginas)}
            </span>
            <button onClick={() => irA(pagina + 1)} disabled={pagina === paginas}
                    className="rounded-md border px-2.5 py-1 disabled:opacity-35"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              Siguiente →
            </button>
          </div>

          <span className="num" style={{ color: "var(--muted)" }}>
            {numero((pagina - 1) * porPagina + 1)}–
            {numero(Math.min(pagina * porPagina, filtrados.length))} de {numero(filtrados.length)}
          </span>
        </div>
      )}
    </div>
  );
}
