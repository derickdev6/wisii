"use client";

import { useEffect, useMemo, useState } from "react";
import type { Gazetteer } from "@/lib/types";
import { numero } from "@/lib/format";
import { sugerir } from "@/lib/similitud";
import { Chip, Nota } from "./ui";

interface Pendiente { texto: string; n: number }

/** "LOMA BARACK" -> "Loma Barack", para proponer un nombre al crear un barrio. */
const titulo = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());

export default function AsignadorBarrios() {
  const [gaz, setGaz] = useState<Gazetteer | null>(null);
  const [editable, setEditable] = useState(false);
  const [cola, setCola] = useState<Pendiente[]>([]);
  const [i, setI] = useState(0);
  /** decisiones de esta sesión: texto -> barrio (sin guardar todavía) */
  const [sesion, setSesion] = useState<{ texto: string; barrio: string; n: number; nuevo: boolean }[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/gazetteer").then((r) => r.json()),
      fetch("/data/pendientes.json").then((r) => r.json()),
    ]).then(([g, p]) => {
      setGaz(g.gazetteer);
      setEditable(g.editable);
      setCola(p.pendientes as Pendiente[]);
    }).catch(() => setMsg({ tipo: "error", texto: "No se pudieron cargar los pendientes" }));
  }, []);

  const nombres = useMemo(() => (gaz ? Object.keys(gaz.barrios).sort() : []), [gaz]);
  const decidido = useMemo(() => new Map(sesion.map((s) => [s.texto, s.barrio])), [sesion]);

  const actual = cola[i];
  const sugerencias = useMemo(
    () => (actual ? sugerir(actual.texto, nombres, 8) : []),
    [actual, nombres]);

  const listaCompleta = useMemo(() => {
    const f = filtro.trim().toUpperCase();
    return f ? nombres.filter((n) => n.toUpperCase().includes(f)) : nombres;
  }, [nombres, filtro]);

  /** Avanza al primer pendiente que todavía no se decidió. */
  function siguientePendiente(desde: number) {
    for (let k = desde; k < cola.length; k++) if (!decidido.has(cola[k].texto)) return k;
    return Math.min(desde, cola.length - 1);
  }

  function asignar(barrio: string, nuevo = false) {
    if (!actual) return;
    setSesion((s) => [
      { texto: actual.texto, barrio, n: actual.n, nuevo },
      ...s.filter((x) => x.texto !== actual.texto),
    ]);
    setI((k) => siguientePendiente(k + 1));
  }

  /** Crea el barrio sin coordenada: se ubica después en el editor. */
  function crearYAsignar() {
    if (!actual) return;
    const nombre = titulo(actual.texto);
    setGaz((g) => g && ({
      ...g,
      barrios: { ...g.barrios, [nombre]: { lat: null, lon: null, src: "sin-ubicar", isla: "San Andrés" } },
    }));
    asignar(nombre, true);
  }

  const deshacer = (texto: string) => setSesion((s) => s.filter((x) => x.texto !== texto));

  async function guardar() {
    if (!gaz || !sesion.length) return;
    setGuardando(true);
    const cuerpo: Gazetteer = {
      ...gaz,
      alias: { ...gaz.alias, ...Object.fromEntries(sesion.map((s) => [s.texto, s.barrio])) },
    };
    try {
      const r = await fetch("/api/gazetteer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "error al guardar");
      const contratos = sesion.reduce((s, x) => s + x.n, 0);
      setMsg({ tipo: "ok",
        texto: `Guardadas ${sesion.length} asignaciones (${numero(contratos)} contratos). `
             + (d.recalculado ? "El mapa ya está recalculado." : "Falta recalcular a mano.") });
      setGaz(cuerpo);
      setSesion([]);
      // los recién asignados salen de la cola
      const asignados = new Set(sesion.map((s) => s.texto));
      setCola((c) => c.filter((p) => !asignados.has(p.texto)));
      setI(0);
    } catch (e) {
      setMsg({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(false);
    }
  }

  if (!gaz) {
    return <div className="p-8 text-sm" style={{ color: "var(--muted)" }}>Cargando pendientes…</div>;
  }

  const pendientesRestantes = cola.filter((p) => !decidido.has(p.texto)).length;
  const contratosSesion = sesion.reduce((s, x) => s + x.n, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        {/* barra de progreso y navegación */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
             style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <strong className="num text-sm">{numero(i + 1)}</strong>
            <span style={{ color: "var(--muted)" }}>de {numero(cola.length)}</span>
            <Chip>{numero(pendientesRestantes)} sin decidir</Chip>
            {sesion.length > 0 && <Chip tono="ok">{sesion.length} en esta sesión</Chip>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0}
                    className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-35"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              ← Anterior
            </button>
            <button onClick={() => setI((k) => Math.min(cola.length - 1, k + 1))}
                    disabled={i >= cola.length - 1}
                    className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-35"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              Siguiente →
            </button>
            <button onClick={guardar} disabled={!sesion.length || !editable || guardando}
                    className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-35"
                    style={{ background: "var(--cta)", color: "var(--cta-ink)" }}>
              {guardando ? "Guardando…" : `Guardar (${sesion.length})`}
            </button>
          </div>
        </div>

        {msg && (
          <p className="px-1 text-xs"
             style={{ color: msg.tipo === "ok" ? "var(--accent)" : "var(--coral)" }}>{msg.texto}</p>
        )}
        {!editable && (
          <Nota>El guardado directo está deshabilitado: esta herramienta solo funciona
            corriendo el proyecto en local.</Nota>
        )}

        {!actual ? (
          <div className="rounded-xl border p-10 text-center text-sm"
               style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
            No quedan domicilios sin reconocer.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {/* izquierda: el texto sin reconocer */}
            <div className="rounded-xl border p-4"
                 style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Domicilio sin reconocer
              </div>
              <p className="mt-2 font-mono text-sm leading-snug">{actual.texto}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Chip tono="alerta">{numero(actual.n)} contratos</Chip>
                {decidido.has(actual.texto) && (
                  <Chip tono="ok">→ {decidido.get(actual.texto)}</Chip>
                )}
              </div>
              <button onClick={crearYAsignar}
                      className="mt-4 w-full rounded-lg border px-3 py-2 text-xs font-medium"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                Crear barrio «{titulo(actual.texto)}» sin ubicación
              </button>
            </div>

            {/* derecha: barrios más parecidos */}
            <div className="rounded-xl border p-4"
                 style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Barrios más parecidos
              </div>
              {sugerencias.length === 0 ? (
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  Ningún nombre se parece lo suficiente. Buscá abajo o pasá al siguiente.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {sugerencias.map((s) => (
                    <li key={s.barrio}>
                      <button onClick={() => asignar(s.barrio)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition hover:bg-[var(--raised)]"
                              style={{ borderColor: s.literal ? "var(--accent)" : "var(--line)" }}>
                        <span className="truncate font-medium">{s.barrio}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {s.literal && <Chip tono="ok">literal</Chip>}
                          <span className="num text-[10px]" style={{ color: "var(--muted)" }}>
                            {(s.puntaje * 100).toFixed(0)}%
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input value={filtro} onChange={(e) => setFiltro(e.target.value)}
                     placeholder="Buscar otro barrio…"
                     className="mt-3 w-full rounded-lg border px-2 py-1.5 text-xs"
                     style={{ borderColor: "var(--line)", background: "var(--raised)", color: "var(--ink)" }} />
              {filtro && (
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                  {listaCompleta.slice(0, 30).map((n) => (
                    <li key={n}>
                      <button onClick={() => { asignar(n); setFiltro(""); }}
                              className="w-full truncate rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--raised)]">
                        {n}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* bitácora de la sesión */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border p-3"
             style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Asignado en esta sesión</h2>
            {sesion.length > 0 && (
              <span className="num text-[11px]" style={{ color: "var(--muted)" }}>
                {numero(contratosSesion)} contratos
              </span>
            )}
          </div>
          {sesion.length === 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Todavía no asignaste nada. Lo que elijas se acumula acá y se escribe al guardar.
            </p>
          )}
        </div>

        {sesion.length > 0 && (
          <div className="overflow-y-auto rounded-xl border" style={{ maxHeight: "56vh", borderColor: "var(--line)", background: "var(--surface)" }}>
            {sesion.map((s) => (
              <div key={s.texto} className="border-b px-3 py-2 text-xs"
                   style={{ borderColor: "var(--line-soft)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-[11px]">{s.texto}</span>
                  <button onClick={() => deshacer(s.texto)} className="shrink-0 text-[11px] underline"
                          style={{ color: "var(--muted)" }}>deshacer</button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span style={{ color: "var(--muted)" }}>→</span>
                  <span className="font-medium">{s.barrio}</span>
                  {s.nuevo && <Chip tono="alerta">nuevo, sin ubicar</Chip>}
                  <span className="num text-[10px]" style={{ color: "var(--muted)" }}>
                    {numero(s.n)} contratos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
