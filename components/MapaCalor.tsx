"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Contrato, Meta } from "@/lib/types";
import { copCorto, numero, cop } from "@/lib/format";
import { Chip, Nota } from "./ui";

type Peso = "n" | "valor";

const RAMPA: [number, string][] = [
  [0.0, "rgba(13,125,140,0)"],
  [0.15, "rgba(62,199,192,0.45)"],
  [0.35, "rgba(120,205,165,0.65)"],
  [0.55, "rgba(224,180,85,0.78)"],
  [0.78, "rgba(230,126,72,0.88)"],
  [1.0, "rgba(203,72,48,0.95)"],
];

function leerVar(el: HTMLElement, nombre: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(nombre).trim();
  return v || fallback;
}

export default function MapaCalor({
  contratos, isla, barrios, meta, onAbrirContrato,
}: {
  contratos: Contrato[];
  isla: FeatureCollection;
  barrios: FeatureCollection;
  meta: Meta;
  onAbrirContrato: (c: Contrato) => void;
}) {
  const cont = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [peso, setPeso] = useState<Peso>("n");
  const [sel, setSel] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const porBarrio = useMemo(() => {
    const m = new Map<string, Contrato[]>();
    for (const c of contratos) if (c.barrio) (m.get(c.barrio) ?? m.set(c.barrio, []).get(c.barrio)!).push(c);
    return m;
  }, [contratos]);

  const maximos = useMemo(() => {
    let n = 0, valor = 0;
    for (const f of barrios.features) {
      n = Math.max(n, (f.properties as { n: number }).n);
      valor = Math.max(valor, (f.properties as { valor: number }).valor);
    }
    return { n, valor };
  }, [barrios]);

  // --- crear el mapa una sola vez ---
  useEffect(() => {
    if (!cont.current || mapRef.current) return;
    const el = cont.current;
    const bbox = (isla.features[0].properties?.bbox as [number, number, number, number]) ?? [
      -81.7357, 12.4803, -81.6873, 12.5949,
    ];

    const map = new maplibregl.Map({
      container: el,
      // Estilo propio: sin proveedor de tiles, la isla se dibuja desde el GeoJSON.
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "mar", type: "background",
                   paint: { "background-color": leerVar(el, "--sea", "#f2f6f7") } }],
      },
      bounds: bbox,
      fitBoundsOptions: { padding: 60 },
      attributionControl: false,
      dragRotate: false,
      maxZoom: 16,
      minZoom: 10,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: "Contorno: © OpenStreetMap · Contratos: SECOP II",
    }), "bottom-right");

    map.on("load", () => {
      map.addSource("isla", { type: "geojson", data: isla });
      map.addLayer({ id: "isla-fill", type: "fill", source: "isla",
        paint: { "fill-color": leerVar(el, "--island", "#e3ded2"), "fill-opacity": 1 } });
      map.addLayer({ id: "isla-line", type: "line", source: "isla",
        paint: { "line-color": leerVar(el, "--island-line", "#c3bba7"), "line-width": 1.2 } });

      map.addSource("barrios", { type: "geojson", data: barrios });
      map.addLayer({
        id: "calor", type: "heatmap", source: "barrios",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "n"], 0, 0, maximos.n, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1.1, 15, 2.4],
          // radio generoso: la incertidumbre de ubicación es de barrio, no de dirección
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 26, 12, 48, 14, 95, 16, 190],
          "heatmap-opacity": 0.85,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
            ...RAMPA.flatMap(([s, c]) => [s, c])] as unknown as maplibregl.ExpressionSpecification,
        },
      });
      // capa invisible solo para detectar clics sobre cada barrio
      map.addLayer({ id: "barrios-hit", type: "circle", source: "barrios",
        paint: { "circle-radius": 16, "circle-opacity": 0 } });

      map.on("click", "barrios-hit", (e) => {
        const p = e.features?.[0]?.properties as { barrio: string } | undefined;
        if (p) setSel(p.barrio);
      });
      map.on("click", (e) => {
        if (!map.queryRenderedFeatures(e.point, { layers: ["barrios-hit"] }).length) setSel(null);
      });
      map.on("mouseenter", "barrios-hit", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "barrios-hit", () => { map.getCanvas().style.cursor = ""; });

      setListo(true);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [isla, barrios, maximos.n]);

  // --- cambiar el peso del heatmap ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    const max = peso === "n" ? maximos.n : maximos.valor;
    map.setPaintProperty("calor", "heatmap-weight",
      ["interpolate", ["linear"], ["get", peso], 0, 0, max, 1]);
  }, [peso, listo, maximos]);

  // --- etiquetas como marcadores HTML (evita depender de un servidor de glyphs) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;

    const feats = [...barrios.features].sort(
      (a, b) => (b.properties as { n: number }).n - (a.properties as { n: number }).n);

    const items = feats.map((f) => {
      const p = f.properties as { barrio: string; n: number; src: string };
      // El elemento raíz del marcador queda para MapLibre (posiciona con transform y
      // administra su propia opacidad). La etiqueta va dentro, y es la que ocultamos.
      const wrap = document.createElement("div");
      const el = document.createElement("button");
      el.className = "whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none";
      el.textContent = `${p.barrio} · ${p.n}`;
      el.title = p.src === "aprox"
        ? `${p.barrio}: ubicación aproximada (±300 m)`
        : `${p.barrio}: ubicación de OpenStreetMap`;
      el.onclick = (ev) => { ev.stopPropagation(); setSel(p.barrio); };
      wrap.appendChild(el);
      const lngLat = f.geometry.type === "Point"
        ? (f.geometry.coordinates as [number, number]) : ([0, 0] as [number, number]);
      const marker = new maplibregl.Marker({ element: wrap, anchor: "left", offset: [10, 0] })
        .setLngLat(lngLat).addTo(map);
      return { nombre: p.barrio, el, lngLat, marker };
    });
    markers.current = items.map((i) => i.marker);

    /** Muestra etiquetas de mayor a menor peso, salteando las que chocan en pantalla.
     *  Al hacer zoom hay más espacio, así que aparecen más solas. */
    const declutter = () => {
      const puestas: { x: number; y: number; w: number; h: number }[] = [];
      const { width, height } = map.getCanvas().getBoundingClientRect();
      const orden = [...items].sort((a, b) =>
        Number(b.nombre === sel) - Number(a.nombre === sel));

      for (const it of orden) {
        const activo = it.nombre === sel;
        // OJO: nada de cssText — MapLibre posiciona el marcador vía style.transform
        // y reescribir el style completo lo mandaría al origen del contenedor.
        const st = it.el.style;
        st.border = `1px solid ${activo ? "var(--accent)" : "var(--line)"}`;
        st.background = activo ? "var(--accent)" : "var(--surface)";
        st.color = activo ? "var(--accent-ink)" : "var(--ink-soft)";
        st.boxShadow = "0 1px 4px rgba(0,0,0,.16)";
        st.cursor = "pointer";
        st.transition = "opacity .15s";

        const p = map.project(it.lngLat);
        const w = it.el.offsetWidth || 70;
        const h = it.el.offsetHeight || 16;
        const r = { x: p.x + 10, y: p.y - h / 2, w, h };

        const fuera = r.x < -w || r.x > width || r.y < -h || r.y > height;
        const choca = puestas.some((q) =>
          r.x < q.x + q.w + 3 && r.x + r.w + 3 > q.x && r.y < q.y + q.h + 2 && r.y + r.h + 2 > q.y);

        const visible = activo || (!fuera && !choca);
        it.el.style.opacity = visible ? (activo ? "1" : "0.95") : "0";
        it.el.style.pointerEvents = visible ? "auto" : "none";
        if (visible) puestas.push(r);
      }
    };

    declutter();
    map.on("move", declutter);
    map.on("zoom", declutter);
    return () => {
      map.off("move", declutter);
      map.off("zoom", declutter);
      items.forEach((i) => i.marker.remove());
      markers.current = [];
    };
  }, [barrios, listo, sel]);

  const detalle = sel ? porBarrio.get(sel) ?? [] : [];
  const detalleValor = detalle.reduce((s, c) => s + c.valor, 0);
  const srcSel = sel
    ? (barrios.features.find((f) => (f.properties as { barrio: string }).barrio === sel)
        ?.properties as { src: string } | undefined)?.src
    : undefined;

  const cobertura = meta.geo.cobertura;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative overflow-hidden rounded-xl border"
           style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div ref={cont} className="h-[68vh] min-h-[460px] w-full" />

        {/* control de peso */}
        <div className="absolute left-3 top-3 flex rounded-lg border p-0.5 text-xs backdrop-blur"
             style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
          {([["n", "Nº de contratos"], ["valor", "Valor contratado"]] as [Peso, string][]).map(
            ([k, label]) => (
              <button key={k} onClick={() => setPeso(k)}
                className="rounded-md px-2.5 py-1 font-medium transition"
                style={peso === k
                  ? { background: "var(--accent)", color: "var(--accent-ink)" }
                  : { color: "var(--muted)" }}>
                {label}
              </button>
            ))}
        </div>

        {/* leyenda */}
        <div className="absolute bottom-3 left-3 rounded-lg border px-3 py-2 backdrop-blur"
             style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Densidad
          </div>
          <div className="mt-1 h-2 w-40 rounded-full"
               style={{ background: `linear-gradient(90deg, ${RAMPA.slice(1).map(([, c]) => c).join(",")})` }} />
          <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
            <span>menos</span><span>más</span>
          </div>
        </div>
      </div>

      {/* panel lateral */}
      <div className="flex flex-col gap-3">
        {!sel ? (
          <>
            <div className="rounded-xl border p-4"
                 style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <h2 className="text-sm font-semibold">Dónde vive quien contrata</h2>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                El calor marca la concentración de <strong>contratistas por barrio de
                residencia</strong>, no el lugar donde se ejecuta el contrato. Tocá un
                barrio para ver su detalle.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg px-2.5 py-2" style={{ background: "var(--raised)" }}>
                  <div className="num text-lg font-semibold">{numero(meta.geo.con_barrio)}</div>
                  <div style={{ color: "var(--muted)" }}>ubicados</div>
                </div>
                <div className="rounded-lg px-2.5 py-2" style={{ background: "var(--raised)" }}>
                  <div className="num text-lg font-semibold">{meta.geo.barrios_ubicados}</div>
                  <div style={{ color: "var(--muted)" }}>barrios</div>
                </div>
              </div>
            </div>
            <Nota>
              <strong>Cómo leer este mapa.</strong> Los contratos del SECOP no traen
              coordenadas: los {numero(meta.contratos)} figuran ejecutándose en la misma
              dirección (la sede de la Gobernación). Lo único con variación geográfica es
              el domicilio del representante legal, y solo{" "}
              <strong>{(cobertura * 100).toFixed(1)}%</strong> pudo ubicarse
              ({numero(meta.geo.sin_dato)} sin domicilio y{" "}
              {numero(meta.geo.no_reconocido)} con texto no reconocido).
              Además {meta.geo.barrios_aprox} de {meta.geo.barrios_ubicados} barrios
              tienen ubicación aproximada. Sirve para ver concentración relativa, no para
              medir montos por zona.
            </Nota>
          </>
        ) : (
          <div className="rounded-xl border"
               style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="flex items-start justify-between gap-2 border-b p-4"
                 style={{ borderColor: "var(--line-soft)" }}>
              <div>
                <h2 className="text-base font-semibold">{sel}</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Chip tono="ok">{numero(detalle.length)} contratos</Chip>
                  <Chip>{copCorto(detalleValor)}</Chip>
                  {srcSel === "aprox" && (
                    <Chip tono="alerta" title="Ubicación colocada a mano, ±300 m">
                      ubicación aproximada
                    </Chip>
                  )}
                </div>
              </div>
              <button onClick={() => setSel(null)}
                      className="rounded-md px-2 py-1 text-xs"
                      style={{ color: "var(--muted)" }}>cerrar</button>
            </div>
            <div className="max-h-[46vh] overflow-y-auto">
              {[...detalle].sort((a, b) => b.valor - a.valor).slice(0, 40).map((c) => (
                <button key={c.id} onClick={() => onAbrirContrato(c)}
                        className="block w-full border-b p-3 text-left transition hover:bg-[var(--raised)]"
                        style={{ borderColor: "var(--line-soft)" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{c.proveedor}</span>
                    <span className="num shrink-0 text-xs" style={{ color: "var(--accent)" }}>
                      {copCorto(c.valor)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug"
                     style={{ color: "var(--muted)" }}>{c.objeto}</p>
                </button>
              ))}
              {detalle.length > 40 && (
                <div className="p-3 text-center text-[11px]" style={{ color: "var(--muted)" }}>
                  y {numero(detalle.length - 40)} más — usá la pestaña Contratos para filtrar
                </div>
              )}
            </div>
            <div className="border-t p-3 text-[11px]" style={{ borderColor: "var(--line-soft)", color: "var(--muted)" }}>
              Total del barrio: <span className="num">{cop(detalleValor)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
