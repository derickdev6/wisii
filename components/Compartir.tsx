"use client";

import { useEffect, useState } from "react";

/**
 * Copia una URL al portapapeles y confirma. Si el navegador bloquea la API
 * (contexto no seguro, permisos), cae a un <input> seleccionado para que la
 * persona copie a mano en vez de quedarse sin nada.
 */
export default function Compartir({ url, etiqueta = "Compartir", titulo }: {
  url: string; etiqueta?: string; titulo?: string;
}) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "manual">("listo");

  useEffect(() => {
    if (estado !== "copiado") return;
    const t = setTimeout(() => setEstado("listo"), 2200);
    return () => clearTimeout(t);
  }, [estado]);

  async function copiar() {
    const abs = typeof window === "undefined" ? url : new URL(url, location.href).href;
    try {
      await navigator.clipboard.writeText(abs);
      setEstado("copiado");
    } catch {
      setEstado("manual");
    }
  }

  if (estado === "manual") {
    const abs = typeof window === "undefined" ? url : new URL(url, location.href).href;
    return (
      <input readOnly value={abs} onFocus={(e) => e.currentTarget.select()} autoFocus
             aria-label="Enlace para copiar"
             className="w-56 rounded-md border px-2 py-1 text-[11px]"
             style={{ borderColor: "var(--cta)", background: "var(--surface)", color: "var(--ink)" }} />
    );
  }

  return (
    <button onClick={copiar} title={titulo ?? etiqueta}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
            style={{
              borderColor: estado === "copiado" ? "var(--cta)" : "var(--line)",
              color: estado === "copiado" ? "var(--cta)" : "var(--ink-soft)",
            }}>
      {estado === "copiado" ? "✓ Enlace copiado" : `⧉ ${etiqueta}`}
    </button>
  );
}
