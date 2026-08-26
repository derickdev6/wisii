"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { Contrato, Meta } from "@/lib/types";
import { cargarTodo } from "@/lib/data";
import { copCorto, fecha, numero } from "@/lib/format";
import { Cargando, Tarjeta } from "@/components/ui";
import Listado from "@/components/Listado";
import DetalleContrato from "@/components/DetalleContrato";

// maplibre toca window en el import: fuera del render del servidor
const MapaCalor = dynamic(() => import("@/components/MapaCalor"), {
  ssr: false, loading: () => <Cargando texto="Dibujando la isla…" />,
});
const EditorBarrios = dynamic(() => import("@/components/EditorBarrios"), {
  ssr: false, loading: () => <Cargando texto="Abriendo el editor…" />,
});

type Vista = "mapa" | "contratos" | "editor";

const VISTAS: [Vista, string][] = [
  ["mapa", "Mapa de calor"],
  ["contratos", "Contratos"],
  ["editor", "Editor de barrios"],
];

interface Datos {
  contratos: Contrato[]; meta: Meta;
  isla: FeatureCollection; barrios: FeatureCollection;
}

export default function Page() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("mapa");
  const [abierto, setAbierto] = useState<Contrato | null>(null);

  useEffect(() => { cargarTodo().then(setD).catch((e) => setError(String(e.message ?? e))); }, []);

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

  const { meta, contratos, isla, barrios } = d;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <header>
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
                   nota={`${numero(meta.proveedores)} proveedores distintos`} />
          <Tarjeta etiqueta="Valor contratado" valor={copCorto(meta.valor_total)}
                   nota="suma de valor_del_contrato" />
          <Tarjeta etiqueta="Contrato mediano" valor={copCorto(meta.valor_mediano)}
                   nota="la mitad de los contratos está por debajo" />
          <Tarjeta etiqueta="Ubicados en el mapa" valor={`${(meta.geo.cobertura * 100).toFixed(1)}%`}
                   nota={`${numero(meta.geo.con_barrio)} en ${meta.geo.barrios_ubicados} barrios`} />
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
          <MapaCalor contratos={contratos} isla={isla} barrios={barrios} meta={meta}
                     onAbrirContrato={setAbierto} />
        )}
        {vista === "contratos" && (
          <Listado contratos={contratos} onAbrirContrato={setAbierto} />
        )}
        {vista === "editor" && <EditorBarrios meta={meta} />}
      </section>

      <footer className="mt-8 border-t pt-4 text-[11px] leading-relaxed"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        Datos abiertos de <a href="https://www.datos.gov.co/d/jbjy-vk9h" target="_blank"
           rel="noopener noreferrer" className="underline">datos.gov.co (SECOP II)</a>.
        Contorno de la isla © OpenStreetMap. El mapa ubica el <strong>domicilio del
        representante legal del contratista</strong>, no el lugar de ejecución del contrato:
        el SECOP registra los {numero(meta.contratos)} contratos en la misma dirección.
        El campo <code>valor_pagado</code> se omite en esta visualización porque solo{" "}
        {meta.con_pago_reportado} de {numero(meta.contratos)} contratos lo reportan: mostrarlo
        sugeriría una ejecución cercana a cero que el dato no respalda.
      </footer>

      {abierto && <DetalleContrato c={abierto} onCerrar={() => setAbierto(null)} />}
    </main>
  );
}
