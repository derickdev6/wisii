"use client";

import { fecha } from "@/lib/format";
import { etiquetaPeriodo, type Periodo } from "@/lib/gobiernos";
import { Chip } from "./ui";

/**
 * Ficha del período constitucional seleccionado. Va debajo de los resultados
 * porque es contexto de lectura, no un control: arriba empujaba la lista y
 * competía con los filtros.
 */
export default function NotaGobierno({ periodo }: { periodo: Periodo }) {
  return (
    <section className="rounded-xl border px-4 py-4"
             style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Quién gobernaba en {etiquetaPeriodo(periodo)}
        </h3>
        <span className="num text-[11px]" style={{ color: "var(--muted)" }}>
          {fecha(periodo.desde)} — {fecha(periodo.hasta)} · elección del {fecha(periodo.eleccion)}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {periodo.gobernantes.map((g) => (
          <li key={g.nombre} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <Chip tono={g.rol === "elegido" ? "ok" : "neutro"}>{g.rol}</Chip>
            <span className="font-medium">{g.nombre}</span>
            {g.nota && (
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>{g.nota}</span>
            )}
          </li>
        ))}
      </ul>

      {periodo.interrumpido && (
        <p className="mt-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
           style={{ background: "color-mix(in srgb, var(--sand) 12%, transparent)",
                    color: "var(--ink-soft)" }}>
          El filtro usa las <strong>fechas legales del período</strong>, no la permanencia
          real de cada persona. Dentro de este período hubo suspensiones o encargos, así que
          los contratos no corresponden todos al mismo gobernante.
        </p>
      )}
    </section>
  );
}
