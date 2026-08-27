"use client";

import { numero } from "@/lib/format";
import { etiquetaPeriodo, periodoPorId, titular, type Periodo } from "@/lib/gobiernos";
import { FILTROS_VACIOS, hayFiltros, type Filtros } from "@/lib/urlEstado";
import type { Filtrado } from "@/lib/filtrado";

function Selector({ etiqueta, valor, onChange, opciones, resaltado }: {
  etiqueta: string; valor: string; onChange: (v: string) => void;
  opciones: [string, number][]; resaltado?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {etiqueta}
      </span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-lg border px-2 py-1.5 text-xs"
        style={{ borderColor: resaltado && valor ? "var(--cta)" : "var(--line)",
                 background: "var(--surface)", color: "var(--ink)" }}>
        <option value="">Todos</option>
        {opciones.map(([v, n]) => (
          <option key={v} value={v}>{v} ({numero(n)})</option>
        ))}
      </select>
    </label>
  );
}

function Fecha({ etiqueta, valor, onChange }: {
  etiqueta: string; valor: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {etiqueta}
      </span>
      <input type="date" value={valor} onChange={(e) => onChange(e.target.value)}
             className="rounded-lg border px-2 py-1.5 text-xs"
             style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
    </label>
  );
}

export default function BarraFiltros({
  filtros, setFiltros, opciones, periodos, conteoPeriodos, conBusqueda,
}: {
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  opciones: Filtrado["opciones"];
  periodos: Periodo[];
  conteoPeriodos: Map<string, number>;
  /** el mapa de calor no lleva buscador de texto */
  conBusqueda: boolean;
}) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros({ ...filtros, [k]: v });

  /** Elegir un gobierno fija las fechas a su período constitucional. */
  const elegirGobierno = (id: string) => {
    const p = id ? periodoPorId(id) : null;
    setFiltros({ ...filtros, gobierno: id, desde: p ? p.desde : "", hasta: p ? p.hasta : "" });
  };

  /** Editar una fecha a mano deja de corresponder a un período: se desmarca. */
  const setDesde = (v: string) => setFiltros({ ...filtros, gobierno: "", desde: v });
  const setHasta = (v: string) => setFiltros({ ...filtros, gobierno: "", hasta: v });

  const limpiar = () => setFiltros({ ...FILTROS_VACIOS, orden: filtros.orden });
  const activos = hayFiltros(filtros);

  return (
    <div className="rounded-xl border p-3"
         style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      {conBusqueda && (
        <div className="relative mb-3">
          <input
            value={filtros.q} onChange={(e) => set("q", e.target.value)}
            placeholder="Buscar en objeto, proveedor, documento, barrio o domicilio…"
            className="w-full rounded-lg border px-3 py-2.5 pr-20 text-sm outline-none"
            style={{ borderColor: "var(--line)", background: "var(--raised)", color: "var(--ink)" }}
          />
          {filtros.q && (
            <button onClick={() => set("q", "")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs"
                    style={{ color: "var(--muted)" }}>limpiar</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Gobierno
          </span>
          <select value={filtros.gobierno} onChange={(e) => elegirGobierno(e.target.value)}
                  className="w-full truncate rounded-lg border px-2 py-1.5 text-xs"
                  style={{ borderColor: filtros.gobierno ? "var(--cta)" : "var(--line)",
                           background: "var(--surface)", color: "var(--ink)" }}>
            <option value="">Todos los períodos</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {etiquetaPeriodo(p)} · {titular(p)} ({numero(conteoPeriodos.get(p.id) ?? 0)})
              </option>
            ))}
          </select>
        </label>

        <Selector etiqueta="Fuente" valor={filtros.fuente} onChange={(v) => set("fuente", v)}
                  opciones={opciones.fuente} resaltado />
        <Selector etiqueta="Estado" valor={filtros.estado} onChange={(v) => set("estado", v)}
                  opciones={opciones.estado} resaltado />
        <Selector etiqueta="Tipo" valor={filtros.tipo} onChange={(v) => set("tipo", v)}
                  opciones={opciones.tipo} resaltado />
        <Selector etiqueta="Modalidad" valor={filtros.modalidad} onChange={(v) => set("modalidad", v)}
                  opciones={opciones.modalidad} resaltado />
        <Selector etiqueta="Barrio" valor={filtros.barrio} onChange={(v) => set("barrio", v)}
                  opciones={opciones.barrio} resaltado />
        <Fecha etiqueta="Firmado desde" valor={filtros.desde} onChange={setDesde} />
        <Fecha etiqueta="Hasta" valor={filtros.hasta} onChange={setHasta} />
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Valor mínimo
          </span>
          <input type="number" inputMode="numeric" value={filtros.minValor} placeholder="0"
                 onChange={(e) => set("minValor", e.target.value)}
                 className="num w-36 rounded-lg border px-2 py-1.5 text-xs"
                 style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
        </label>
        {activos && (
          <button onClick={limpiar} className="rounded-md border px-2.5 py-1.5 text-xs"
                  style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            quitar filtros
          </button>
        )}
      </div>
    </div>
  );
}
