"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FeatureCollection } from "geojson";
import type { Contrato, Meta } from "@/lib/types";
import { cargarTodo } from "@/lib/data";
import { copCorto, fecha, numero } from "@/lib/format";
import Link from "next/link";
import { Cargando, Tarjeta } from "@/components/ui";
import TemaToggle from "@/components/TemaToggle";
import {
  escribirUrl, FILTROS_VACIOS, leerContrato, leerFiltros, leerVista,
  type Filtros, type Vista,
} from "@/lib/urlEstado";
import Listado from "@/components/Listado";
import DetalleContrato from "@/components/DetalleContrato";

// maplibre toca window en el import: fuera del render del servidor
const MapaCalor = dynamic(() => import("@/components/MapaCalor"), {
  ssr: false, loading: () => <Cargando texto="Dibujando la isla…" />,
});
const EditorBarrios = dynamic(() => import("@/components/EditorBarrios"), {
  ssr: false, loading: () => <Cargando texto="Abriendo el editor…" />,
});

const VISTAS: [Vista, string][] = [
  ["mapa", "Mapa de calor"],
  ["contratos", "Contratos"],
  ["editor", "Editor de barrios"],
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
  const [vista, setVista] = useState<Vista>(() => leerVista(new URLSearchParams(sp.toString())));
  const [filtros, setFiltros] = useState<Filtros>(() => leerFiltros(new URLSearchParams(sp.toString())));
  const [abiertoId, setAbiertoId] = useState<string | null>(
    () => leerContrato(new URLSearchParams(sp.toString())));

  useEffect(() => { cargarTodo().then(setD).catch((e) => setError(String(e.message ?? e))); }, []);

  const url = escribirUrl(vista, filtros, abiertoId);
  useEffect(() => { router.replace(`/contratos${url}`, { scroll: false }); }, [url, router]);

  const abierto = useMemo(
    () => (d && abiertoId ? d.contratos.find((c) => c.id === abiertoId) ?? null : null),
    [d, abiertoId]);
  /** el enlace traía un id que no existe en los datos publicados */
  const noEncontrado = Boolean(d && abiertoId && !abierto);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold" style={{ color: "var(--coral)" }}>No se pudieron cargar los datos</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{error}</p>
        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          Generá los archivos con <code>npm run data:all</code>.
        </p>
      </main>
    );
  }
  if (!d) return <Cargando texto="Cargando contratos…" />;

  const { meta, contratos, islas, barrios } = d;

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
              {meta.entidad} · NIT {meta.nit} — contratos firmados entre{" "}
              {fecha(meta.desde)} y {fecha(meta.hasta)}
            </p>
          </div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            {meta.fuente}
            <br />
            Actualizado {meta.actualizado.slice(0, 10)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tarjeta etiqueta="Contratos" valor={numero(meta.contratos)}
                   nota={`${numero(meta.por_fuente["SECOP II"] ?? 0)} en SECOP II · ${numero(meta.por_fuente["SECOP I"] ?? 0)} en SECOP I`} />
          <Tarjeta etiqueta="Valor contratado" valor={copCorto(meta.valor_total)}
                   nota="suma de valor_del_contrato" />
          <Tarjeta etiqueta="Contrato mediano" valor={copCorto(meta.valor_mediano)}
                   nota="la mitad de los contratos está por debajo" />
          <Tarjeta etiqueta="Ubicados en el mapa" valor={`${(meta.geo.cobertura * 100).toFixed(1)}%`}
                   nota={`${numero(meta.geo.con_barrio)} de ${numero(meta.geo.mapeables)} con domicilio publicado`} />
        </div>

        <nav className="mt-5 flex gap-1 rounded-lg border p-1 text-sm"
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

      <section className="mt-4">
        {vista === "mapa" && (
          <MapaCalor contratos={contratos} islas={islas} barrios={barrios} meta={meta}
                     onAbrirContrato={(c) => setAbiertoId(c.id)} />
        )}
        {vista === "contratos" && (
          <Listado contratos={contratos} filtros={filtros} setFiltros={setFiltros}
                   urlCompartir={`/contratos${escribirUrl("contratos", filtros, null)}`}
                   onAbrirContrato={(c) => setAbiertoId(c.id)} />
        )}
        {vista === "editor" && <EditorBarrios meta={meta} />}
      </section>

      <footer className="mt-8 border-t pt-4 text-[11px] leading-relaxed"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        Datos abiertos de datos.gov.co:{" "}
        <a href="https://www.datos.gov.co/d/jbjy-vk9h" target="_blank"
           rel="noopener noreferrer" className="underline">SECOP II</a>{" "}
        (2020-2026) y{" "}
        <a href="https://www.datos.gov.co/d/f789-7hwg" target="_blank"
           rel="noopener noreferrer" className="underline">SECOP I</a>{" "}
        (2015-2022).
        Contorno de la isla © OpenStreetMap. El mapa ubica el <strong>domicilio del
        representante legal del contratista</strong>, no el lugar de ejecución del contrato:
        el SECOP registra todos los contratos en la misma dirección, y SECOP I ni siquiera
        publica ese campo. Se descartaron {meta.duplicados_descartados} registros que
        aparecían en ambos sistemas con el mismo contratista, fecha y valor.
        El campo <code>valor_pagado</code> se omite en esta visualización porque solo{" "}
        {meta.con_pago_reportado} de {numero(meta.contratos)} contratos lo reportan: mostrarlo
        sugeriría una ejecución cercana a cero que el dato no respalda.
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
        <DetalleContrato
          c={abierto}
          url={`/contratos${escribirUrl(vista, filtros, abierto.id)}`}
          onCerrar={() => setAbiertoId(null)}
        />
      )}
    </main>
  );
}
