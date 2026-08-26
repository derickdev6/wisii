"use client";
import type { ReactNode } from "react";

export function Tarjeta({ etiqueta, valor, nota }: {
  etiqueta: string; valor: ReactNode; nota?: ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4"
         style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {etiqueta}
      </div>
      <div className="num mt-1.5 text-2xl font-semibold leading-none">{valor}</div>
      {nota && <div className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>{nota}</div>}
    </div>
  );
}

export function Chip({ children, tono = "neutro", title }: {
  children: ReactNode; tono?: "neutro" | "activo" | "alerta" | "ok"; title?: string;
}) {
  const tonos = {
    neutro: { background: "var(--raised)", color: "var(--ink-soft)", borderColor: "var(--line)" },
    activo: { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" },
    alerta: { background: "color-mix(in srgb, var(--coral) 14%, transparent)", color: "var(--coral)", borderColor: "color-mix(in srgb, var(--coral) 35%, transparent)" },
    ok:     { background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" },
  }[tono];
  return (
    <span title={title}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
          style={tonos}>
      {children}
    </span>
  );
}

/** Aviso metodológico. La honestidad sobre el dato es parte de la interfaz. */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
         style={{ borderColor: "color-mix(in srgb, var(--sand) 35%, transparent)",
                  background: "color-mix(in srgb, var(--sand) 10%, transparent)",
                  color: "var(--ink-soft)" }}>
      {children}
    </div>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
             style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{texto}</div>
      </div>
    </div>
  );
}
