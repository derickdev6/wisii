"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FeatureCollection } from "geojson";
import type { Contrato, Meta } from "@/lib/types";
import { cargarTodo } from "@/lib/data";
import { fecha, numero } from "@/lib/format";
import { useFiltrado } from "@/lib/filtrado";
import { periodoPorId } from "@/lib/gobiernos";
import {
  escribirUrl, leerContrato, leerFiltros, leerVista, type Filtros, type Vista,
} from "@/lib/urlEstado";
import { Cargando } from "@/components/ui";
import TemaToggle from "@/components/TemaToggle";
import BarraFiltros from "@/components/BarraFiltros";
import Listado from "@/components/Listado";
import NotaGobierno from "@/components/NotaGobierno";
import DetalleContrato from "@/components/DetalleContrato";

// maplibre toca window en el import: fuera del render del servidor
const MapaCalor = dynamic(() => import("@/components/MapaCalor"), {
  ssr: false, loading: () => <Cargando texto="Dibujando las islas…" />,
});
const EditorBarrios = dynamic(() => import("@/components/EditorBarrios"), {
  ssr: false, loading: () => <Cargando texto="Abriendo el editor…" />,
});
const AsignadorBarrios = dynamic(() => import("@/components/AsignadorBarrios"), {
  ssr: false, loading: () => <Cargando texto="Cargando pendientes…" />,
});

/** Las herramientas de barrios escriben en disco: solo existen en local. */
const EDITOR_DISPONIBLE = process.env.NEXT_PUBLIC_EDITOR_BARRIOS !== "0";
const HERRAMIENTAS: Vista[] = ["editor", "asignador"];

const VISTAS: [Vista, string][] = [
  ["contratos", "Contratos"],
  ["mapa", "Mapa de calor"],
  ...(EDITOR_DISPONIBLE
    ? ([["editor", "Editor de barrios"], ["asignador", "Asignador de barrios"]] as [Vista, string][])
    : []),
];

interface Datos {
  contratos: Contrato[]; meta: Meta;
  islas: FeatureCollection; barrios: FeatureCollection;
}

export default function Page() {
  // useSearchParams necesita un límite de Suspense en una página prerenderizada
  return (
    <Suspense fallback={<Cargando texto="Cargando contratos…" />}>
      <Explorador />
    </Suspense>
  );
}

function Explorador() {
  const router = useRouter();
  const sp = useSearchParams();

  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El estado arranca desde la URL, así un enlace compartido abre exactamente
  // la misma búsqueda. Después vive en React y se refleja de vuelta con
  // replace(), para no llenar el historial con cada tecla del buscador.
  const [vista, setVista] = useState<Vista>(() => {
    const v = leerVista(new URLSearchParams(sp.toString()));
    // un enlace a una herramienta local en un despliegue cae al listado
    return HERRAMIENTAS.includes(v) && !EDITOR_DISPONIBLE ? "contratos" : v;
  });
  const [filtros, setFiltros] = useState<Filtros>(() => leerFiltros(new URLSearchParams(sp.toString())));
  const [abiertoId, setAbiertoId] = useState<string | null>(
    () => leerContrato(new URLSearchParams(sp.toString())));

  useEffect(() => { cargarTodo().then(setD).catch((e) => setError(String(e.message ?? e))); }, []);

  const url = escribirUrl(vista, filtros, abiertoId);
  useEffect(() => { router.replace(`/contratos${url}`, { scroll: false }); }, [url, router]);

  const contratos = useMemo(() => d?.contratos ?? [], [d]);
  // El mapa no tiene buscador de texto, pero comparte todos los demás filtros.
  const enMapa = vista === "mapa";
  const filtrado = useFiltrado(contratos, filtros, enMapa);

  const abierto = useMemo(
    () => (d && abiertoId ? contratos.find((c) => c.id === abiertoId) ?? null : null),
    [d, abiertoId, contratos]);
  /** el enlace traía un id que no existe en los datos publicados */
  const noEncontrado = Boolean(d && abiertoId && !abierto);

  const periodoSel = filtros.gobierno ? periodoPorId(filtros.gobierno) : null;

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold" style={{ color: "var(--coral)" }}>
          No se pudieron cargar los datos
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{error}</p>
        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          Generá los archivos con <code>npm run data:all</code>.
        </p>
      </main>
    );
  }
  if (!d) return <Cargando texto="Cargando contratos…" />;

  const { meta, islas, barrios } = d;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <header>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/" className="text-xs font-medium transition hover:opacity-70"
                style={{ color: "var(--muted)" }}>
            ← WiSii
          </Link>
          <TemaToggle />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Contratación de la Gobernación de San Andrés
            </h1>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {numero(meta.contratos)} contratos firmados entre {fecha(meta.desde)} y{" "}
              {fecha(meta.hasta)} · {meta.fuente}
            </p>
          </div>
        </div>

        <nav className="mt-4 flex gap-1 rounded-lg border p-1 text-sm"
             style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {VISTAS.map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)}
                    className="rounded-md px-3 py-1.5 font-medium transition"
                    style={vista === v
                      ? { background: "var(--accent)", color: "var(--accent-ink)" }
                      : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
        </nav>
      </header>

      {/* La barra de filtros es la misma en las dos vistas; solo el listado
          lleva buscador de texto. */}
      {!HERRAMIENTAS.includes(vista) && (
        <div className="mt-4">
          <BarraFiltros filtros={filtros} setFiltros={setFiltros}
                        opciones={filtrado.opciones} periodos={filtrado.periodos}
                        conteoPeriodos={filtrado.conteoPeriodos}
                        conBusqueda={vista === "contratos"} />
        </div>
      )}

      <section className="mt-4">
        {vista === "contratos" && (
          <Listado filtrados={filtrado.filtrados} total={filtrado.total}
                   universo={contratos.length} filtros={filtros} setFiltros={setFiltros}
                   urlCompartir={`/contratos${escribirUrl("contratos", filtros, null)}`}
                   onAbrirContrato={(c) => setAbiertoId(c.id)} />
        )}
        {vista === "mapa" && (
          <MapaCalor contratos={filtrado.filtrados} islas={islas} barrios={barrios}
                     meta={meta} onAbrirContrato={(c) => setAbiertoId(c.id)} />
        )}
        {vista === "editor" && EDITOR_DISPONIBLE && <EditorBarrios meta={meta} />}
        {vista === "asignador" && EDITOR_DISPONIBLE && <AsignadorBarrios />}
      </section>

      {/* contexto de lectura, debajo de los resultados */}
      {periodoSel && !HERRAMIENTAS.includes(vista) && (
        <div className="mt-5"><NotaGobierno periodo={periodoSel} /></div>
      )}

      <footer className="mt-8 border-t pt-4 text-[11px] leading-relaxed"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        Datos abiertos de datos.gov.co:{" "}
        <a href="https://www.datos.gov.co/d/jbjy-vk9h" target="_blank"
           rel="noopener noreferrer" className="underline">SECOP II</a>{" "}
        (2020-2026) y{" "}
        <a href="https://www.datos.gov.co/d/f789-7hwg" target="_blank"
           rel="noopener noreferrer" className="underline">SECOP I</a>{" "}
        (2015-2022). Contorno de las islas © OpenStreetMap. El mapa ubica el{" "}
        <strong>domicilio del representante legal del contratista</strong>, no el lugar de
        ejecución: el SECOP registra todos los contratos en la misma dirección, y SECOP I
        ni siquiera publica ese campo. Se descartaron {meta.duplicados_descartados} registros
        que aparecían en ambos sistemas. El campo <code>valor_pagado</code> se omite porque
        solo {meta.con_pago_reportado} de {numero(meta.contratos)} contratos lo reportan.
      </footer>

      {noEncontrado && (
        <div role="status"
             className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-xs shadow-lg"
             style={{ borderColor: "var(--coral)", background: "var(--surface)", color: "var(--ink)" }}>
          El contrato <code>{abiertoId}</code> no está en los datos publicados.
          <button onClick={() => setAbiertoId(null)} className="ml-3 underline"
                  style={{ color: "var(--muted)" }}>cerrar</button>
        </div>
      )}

      {abierto && (
        <DetalleContrato c={abierto}
                         url={`/contratos${escribirUrl(vista, filtros, abierto.id)}`}
                         onCerrar={() => setAbiertoId(null)} />
      )}
    </main>
  );
}
