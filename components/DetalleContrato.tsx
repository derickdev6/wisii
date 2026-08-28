"use client";

import { useEffect } from "react";
import type { Contrato } from "@/lib/types";
import { cop, fecha, secopUrl } from "@/lib/format";
import { Chip } from "./ui";
import Compartir from "./Compartir";

function Campo({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="border-b py-2.5" style={{ borderColor: "var(--line-soft)" }}>
      <dt className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono text-xs" : ""}`}>{v || "—"}</dd>
    </div>
  );
}

export default function DetalleContrato({ c, url: urlCompartir, onCerrar }: {
  c: Contrato;
  /** enlace que reabre este contrato tal cual */
  url: string;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onCerrar]);

  const url = secopUrl(c.fuente, c.enlace);
  const pct = c.valor > 0 ? Math.min(100, (c.pagado / c.valor) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
         style={{ background: "rgba(4,16,20,.55)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()}
           className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border sm:rounded-2xl"
           style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b p-5 backdrop-blur"
             style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface) 94%, transparent)" }}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tono={c.estado === "En ejecución" ? "ok" : "neutro"}>{c.estado}</Chip>
              <Chip>{c.tipo}</Chip>
              <Chip tono={c.fuente === "SECOP I" ? "alerta" : "neutro"}
                    title={c.fuente === "SECOP I"
                      ? "Sistema anterior: no publica domicilio del contratista ni ejecución de pagos"
                      : "Sistema vigente"}>{c.fuente}</Chip>
              {c.barrio && <Chip>{c.barrio}</Chip>}
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-tight">{c.proveedor}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Compartir url={urlCompartir} etiqueta="Compartir"
                       titulo="Copia un enlace que abre este contrato" />
            <button onClick={onCerrar} aria-label="Cerrar"
                    className="rounded-lg border px-2.5 py-1 text-sm"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}>✕</button>
          </div>
        </div>

        <div className="p-5">
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--raised)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Valor del contrato
                </div>
                <div className="num text-2xl font-semibold">{cop(c.valor)}</div>
              </div>
              {c.pagado > 0 && (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Pagado</div>
                  <div className="num text-lg font-medium" style={{ color: "var(--accent)" }}>{cop(c.pagado)}</div>
                </div>
              )}
            </div>
            {c.pagado > 0 ? (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                </div>
                <div className="mt-1.5 num text-[11px]" style={{ color: "var(--muted)" }}>
                  {pct.toFixed(1)}% ejecutado
                </div>
              </>
            ) : (
              // el 99,9% de los contratos de esta entidad no reporta pagos en el SECOP
              <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                Sin registro de pagos en el SECOP para este contrato.
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Objeto del contrato
            </div>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{c.objeto}</p>
          </div>

          <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
            <Campo k="Firma" v={fecha(c.firma)} />
            <Campo k="Finaliza" v={fecha(c.fin)} />
            <Campo k="Duración" v={c.duracion} />
            <Campo k="Entidad contratante" v={c.entidad} />
            <Campo k="Tipo" v={c.tipo} />
            <Campo k="Modalidad" v={c.modalidad} />
            <Campo k="Origen de recursos" v={c.origen} />
            <Campo k="Destino del gasto" v={c.destino} />
            <Campo k="Documento del proveedor" v={c.documento} mono />
            <Campo k="Domicilio del rep. legal"
                   v={c.fuente === "SECOP I" ? "no publicado en SECOP I" : c.domicilio} />
            <Campo k="ID del contrato" v={c.id} mono />
          </dl>

          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
               className="mt-5 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
               style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              {`Ver en ${c.fuente} ↗`}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
