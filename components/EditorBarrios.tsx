"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import type { Gazetteer, Meta } from "@/lib/types";
import { numero } from "@/lib/format";
import { Chip, Nota } from "./ui";

/** Centro y zoom por isla. El editor trabaja sobre coordenadas REALES (imagen
 *  satelital), no sobre las desplazadas que usa el mapa de calor. */
const ISLAS = {
  "San Andrés":  { centro: [-81.7115, 12.5426] as [number, number], zoom: 12.2 },
  "Providencia": { centro: [-81.3720, 13.3550] as [number, number], zoom: 12.8 },
} as const;

type Isla = keyof typeof ISLAS;

const BASES = {
  sat: {
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  },
  calle: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
  },
} as const;

type Base = keyof typeof BASES;

/** "LOMA BARRACK" -> "Loma Barrack" */
const titulo = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());

export default function EditorBarrios({ meta }: { meta: Meta }) {
  const cont = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const marcadores = useRef<Map<string, Marker>>(new Map());

  const [gaz, setGaz] = useState<Gazetteer | null>(null);
  const [editable, setEditable] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [sucio, setSucio] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [tab, setTab] = useState<"barrios" | "pendientes">("barrios");
  const [filtro, setFiltro] = useState("");
  const [base, setBase] = useState<Base>("sat");
  const [listo, setListo] = useState(false);
  /** texto pendiente en proceso de convertirse en barrio nuevo */
  const [creando, setCreando] = useState<{ alias: string; nombre: string } | null>(null);
  const [isla, setIsla] = useState<Isla>("San Andrés");

  const porBarrio = meta.por_barrio ?? {};
  const pendientes = meta.pendientes ?? [];

  useEffect(() => {
    fetch("/api/gazetteer")
      .then((r) => r.json())
      .then((d) => { setGaz(d.gazetteer); setEditable(d.editable); })
      .catch(() => setMsg({ tipo: "error", texto: "No se pudo cargar el gazetteer" }));
  }, []);

  // --- mapa ---
  // Se monta recién cuando hay gazetteer, porque antes el contenedor no existe
  // (hay un return temprano). El booleano cambia una sola vez: null -> cargado,
  // así el cleanup no destruye el mapa en cada edición.
  const hayGaz = gaz !== null;
  useEffect(() => {
    if (!hayGaz || !cont.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: cont.current,
      style: {
        version: 8,
        sources: {
          sat: { type: "raster", tiles: [...BASES.sat.tiles], tileSize: 256, attribution: BASES.sat.attribution },
          calle: { type: "raster", tiles: [...BASES.calle.tiles], tileSize: 256, attribution: BASES.calle.attribution },
        },
        layers: [
          { id: "base-sat", type: "raster", source: "sat", layout: { visibility: "visible" } },
          { id: "base-calle", type: "raster", source: "calle", layout: { visibility: "none" } },
        ],
      },
      center: ISLAS["San Andrés"].centro, zoom: ISLAS["San Andrés"].zoom,
      maxZoom: 19, minZoom: 10, dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
    map.on("load", () => { map.resize(); setListo(true); });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(cont.current);

    mapRef.current = map;
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, [hayGaz]);

  function cambiarIsla(i: Isla) {
    setIsla(i);
    setSel(null);
    setCreando(null);
    mapRef.current?.flyTo({ center: ISLAS[i].centro, zoom: ISLAS[i].zoom, duration: 900 });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    map.setLayoutProperty("base-sat", "visibility", base === "sat" ? "visible" : "none");
    map.setLayoutProperty("base-calle", "visibility", base === "calle" ? "visible" : "none");
  }, [base, listo]);

  // clic en el mapa: ubica el barrio seleccionado, o crea el que se está definiendo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      if (creando) {
        crear(creando.nombre, creando.alias, lat, lng);
        setCreando(null);
      } else if (sel) {
        mover(sel, lat, lng);
      }
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [listo, sel, creando]);

  // --- marcadores ---
  const todos = useMemo(() => (gaz ? Object.keys(gaz.barrios).sort() : []), [gaz]);
  const nombres = useMemo(
    () => todos.filter((n) => (gaz?.barrios[n].isla ?? "San Andrés") === isla),
    [todos, gaz, isla]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo || !gaz) return;

    // fuera los marcadores borrados o los de la otra isla
    for (const [nombre, m] of marcadores.current) {
      if (!gaz.barrios[nombre] || !nombres.includes(nombre)) {
        m.remove(); marcadores.current.delete(nombre);
      }
    }

    for (const nombre of nombres) {
      const b = gaz.barrios[nombre];
      // sin coordenada no hay nada que dibujar
      if (b.lat == null || b.lon == null) {
        const m = marcadores.current.get(nombre);
        if (m) { m.remove(); marcadores.current.delete(nombre); }
        continue;
      }
      const activo = sel === nombre;
      const n = porBarrio[nombre] ?? 0;
      let m = marcadores.current.get(nombre);

      if (!m) {
        const el = document.createElement("div");
        el.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;transform:translateX(-6px)";
        el.innerHTML = `<span data-punto></span><span data-tag></span>`;
        el.onclick = (ev) => { ev.stopPropagation(); setSel(nombre); };
        m = new maplibregl.Marker({ element: el, draggable: true, anchor: "left" })
          .setLngLat([b.lon, b.lat]).addTo(map);
        m.on("dragend", () => {
          const { lat, lng } = m!.getLngLat();
          mover(nombre, lat, lng);
        });
        marcadores.current.set(nombre, m);
      }

      m.setLngLat([b.lon, b.lat]);
      m.setDraggable(activo);
      const el = m.getElement();
      const punto = el.querySelector("[data-punto]") as HTMLElement;
      const tag = el.querySelector("[data-tag]") as HTMLElement;
      const color = activo ? "#3ec7c0" : b.src === "aprox" ? "#f4795c" : "#ffffff";
      punto.style.cssText = `width:${activo ? 13 : 9}px;height:${activo ? 13 : 9}px;border-radius:50%;
        background:${color};border:2px solid rgba(0,0,0,.55);box-shadow:0 0 0 1px rgba(255,255,255,.5)`;
      tag.textContent = `${nombre}${n ? ` · ${n}` : ""}`;
      tag.style.cssText = `font:600 10px/1 ui-sans-serif,system-ui;padding:3px 6px;border-radius:99px;
        white-space:nowrap;background:${activo ? "#3ec7c0" : "rgba(8,24,30,.78)"};
        color:${activo ? "#06222a" : "#e8f2f4"};opacity:${activo ? 1 : 0.9}`;
    }
  }, [gaz, nombres, sel, listo, porBarrio, isla]);

  function mover(nombre: string, lat: number, lon: number) {
    setGaz((g) => g && ({
      ...g,
      barrios: { ...g.barrios, [nombre]: {
        lat: +lat.toFixed(5), lon: +lon.toFixed(5), src: "manual",
        isla: g.barrios[nombre]?.isla ?? isla } },
    }));
    setSucio(true);
  }

  function crear(nombre: string, alias: string, lat: number, lon: number) {
    setGaz((g) => g && ({
      ...g,
      barrios: { ...g.barrios, [nombre]: {
        lat: +lat.toFixed(5), lon: +lon.toFixed(5), src: "manual", isla } },
      alias: { ...g.alias, [alias]: nombre },
    }));
    setSel(nombre); setSucio(true);
    setMsg({ tipo: "ok", texto: `Creado «${nombre}» y alias «${alias}»` });
  }

  /** Deja el barrio en el gazetteer pero sin ubicación: los alias siguen
   *  reconociendo el domicilio y el contrato deja de contarse en el mapa. */
  function quitarUbicacion(nombre: string) {
    setGaz((g) => g && ({
      ...g,
      barrios: { ...g.barrios, [nombre]: {
        ...g.barrios[nombre], lat: null, lon: null, src: "sin-ubicar" } },
    }));
    setSucio(true);
    setMsg({ tipo: "ok", texto: `«${nombre}» queda sin ubicación; su alias sigue activo.` });
  }

  function asignarAlias(alias: string, barrio: string) {
    setGaz((g) => g && ({ ...g, alias: { ...g.alias, [alias]: barrio } }));
    setSucio(true);
    setMsg({ tipo: "ok", texto: `«${alias}» → ${barrio}` });
  }

  function irA(nombre: string) {
    const b = gaz?.barrios[nombre];
    setSel(nombre);
    if (b && b.lat != null && b.lon != null) {
      mapRef.current?.flyTo({ center: [b.lon, b.lat], zoom: 15.5, duration: 700 });
    }
  }

  async function guardar() {
    if (!gaz) return;
    const r = await fetch("/api/gazetteer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gaz),
    });
    const d = await r.json();
    if (r.ok) {
      setSucio(false);
      setMsg(d.recalculado
        ? { tipo: "ok", texto: `Guardado y recalculado: ${d.barrios} barrios, ${d.alias} alias`
            + (d.sinUbicar ? `, ${d.sinUbicar} sin ubicar` : "")
            + ". El mapa de calor ya refleja los cambios." }
        : { tipo: "error", texto: `Guardado, pero el recálculo falló (${d.error}). Corré «npm run data:build» a mano.` });
    } else {
      setMsg({ tipo: "error", texto: d.error ?? "Error al guardar" });
    }
  }

  function descargar() {
    if (!gaz) return;
    const blob = new Blob([JSON.stringify(gaz, null, 1) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gazetteer.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const lista = useMemo(() => {
    if (!gaz) return [];
    const f = filtro.toLowerCase();
    return nombres
      .filter((n) => !f || n.toLowerCase().includes(f))
      // los que no tienen coordenada van al final, para que no estorben
      .sort((a, b) => {
        const ua = gaz.barrios[a].lat == null ? 1 : 0;
        const ub = gaz.barrios[b].lat == null ? 1 : 0;
        return ua - ub || (porBarrio[b] ?? 0) - (porBarrio[a] ?? 0) || a.localeCompare(b);
      });
  }, [gaz, nombres, filtro, porBarrio]);

  const aprox = nombres.filter((n) => gaz?.barrios[n].src === "aprox").length;
  const sinUbicar = nombres.filter(
    (n) => gaz?.barrios[n].lat == null || gaz?.barrios[n].lon == null).length;
  const enOtraIsla = todos.length - nombres.length;

  if (!gaz) return <div className="p-8 text-sm" style={{ color: "var(--muted)" }}>Cargando gazetteer…</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="relative overflow-hidden rounded-xl border"
           style={{ borderColor: "var(--line)" }}>
        <div ref={cont} className="h-[72vh] min-h-[480px] w-full" />

        <div className="absolute left-3 top-3 flex gap-2">
          <div className="flex rounded-lg border p-0.5 text-xs backdrop-blur"
               style={{ borderColor: "var(--accent)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
            {(Object.keys(ISLAS) as Isla[]).map((k) => (
              <button key={k} onClick={() => cambiarIsla(k)}
                      className="rounded-md px-2.5 py-1 font-medium"
                      style={isla === k ? { background: "var(--accent)", color: "var(--accent-ink)" } : { color: "var(--muted)" }}>
                {k}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border p-0.5 text-xs backdrop-blur"
               style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
          {([["sat", "Satélite"], ["calle", "Calles"]] as [Base, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setBase(k)} className="rounded-md px-2.5 py-1 font-medium"
                    style={base === k ? { background: "var(--accent)", color: "var(--accent-ink)" } : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
          </div>
        </div>

        {(sel || creando) && (
          <div className="absolute bottom-8 left-3 right-3 rounded-lg border px-3 py-2 text-xs backdrop-blur"
               style={{ borderColor: "var(--accent)", background: "color-mix(in srgb, var(--surface) 92%, transparent)" }}>
            {creando ? (
              <>Hacé clic en el mapa para ubicar <strong>{creando.nombre}</strong>{" "}
                <button onClick={() => setCreando(null)} className="ml-2 underline" style={{ color: "var(--muted)" }}>cancelar</button></>
            ) : (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {gaz.barrios[sel!]?.lat == null ? (
                  <>Sin ubicación conocida: hacé clic en el mapa para ubicar{" "}
                    <strong>{sel}</strong>.</>
                ) : (
                  <>Editando <strong>{sel}</strong> — clic en el mapa o arrastrá el punto.{" "}
                    <span className="num" style={{ color: "var(--muted)" }}>
                      {gaz.barrios[sel!]!.lat!.toFixed(5)}, {gaz.barrios[sel!]!.lon!.toFixed(5)}
                    </span>
                    <button onClick={() => quitarUbicacion(sel!)}
                            className="rounded-md border px-2 py-0.5"
                            style={{ borderColor: "var(--coral)", color: "var(--coral)" }}>
                      Quitar ubicación
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Barrios de {isla}</div>
            <div className="flex gap-1.5">
              <button onClick={descargar} className="rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>Descargar</button>
              <button onClick={guardar} disabled={!sucio || !editable}
                      className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                {sucio ? "Guardar" : "Guardado"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>{nombres.length} barrios</Chip>
            <Chip tono={aprox ? "alerta" : "ok"}>{aprox} aproximados</Chip>
            {sinUbicar > 0 && <Chip tono="alerta">{sinUbicar} sin ubicar</Chip>}
            <Chip>{Object.keys(gaz.alias).length} alias</Chip>
            <Chip>{enOtraIsla} en la otra isla</Chip>
          </div>
          {!editable && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--coral)" }}>
              Desplegado en Vercel: el guardado directo está deshabilitado. Usá «Descargar»
              y reemplazá <code>data/gazetteer.json</code> en el repo.
            </p>
          )}
          {msg && (
            <p className="mt-2 text-[11px]"
               style={{ color: msg.tipo === "ok" ? "var(--accent)" : "var(--coral)" }}>{msg.texto}</p>
          )}
        </div>

        <div className="flex gap-1 rounded-lg border p-0.5 text-xs"
             style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {([["barrios", `${isla} (${nombres.length})`],
             ["pendientes", `Sin reconocer (${pendientes.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
                    className="flex-1 rounded-md px-2 py-1.5 font-medium"
                    style={tab === k ? { background: "var(--accent)", color: "var(--accent-ink)" } : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
        </div>

        {tab === "barrios" ? (
          <>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar barrio…"
                   className="rounded-lg border px-3 py-2 text-xs"
                   style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
            <div className="flex-1 overflow-y-auto rounded-xl border"
                 style={{ borderColor: "var(--line)", background: "var(--surface)", maxHeight: "44vh" }}>
              {lista.map((n) => {
                const b = gaz.barrios[n];
                return (
                  <button key={n} onClick={() => irA(n)}
                          className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left transition hover:bg-[var(--raised)]"
                          style={{ borderColor: "var(--line-soft)",
                                   background: sel === n ? "var(--raised)" : undefined }}>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{n}</span>
                      <span className="num text-[10px]" style={{ color: "var(--muted)" }}>
                        {b.lat != null && b.lon != null
                          ? `${b.lat.toFixed(4)}, ${b.lon.toFixed(4)}`
                          : "sin ubicación"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {porBarrio[n] ? (
                        <span className="num text-xs font-semibold" style={{ color: "var(--accent)" }}>
                          {numero(porBarrio[n])}
                        </span>
                      ) : null}
                      <Chip tono={b.lat == null ? "alerta"
                                  : b.src === "aprox" ? "alerta"
                                  : b.src === "manual" ? "ok" : "neutro"}>
                        {b.lat == null ? "sin ubicar"
                         : b.src === "osm-place" ? "OSM"
                         : b.src === "manual" ? "editado" : "aprox"}
                      </Chip>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <Nota>
              Textos de <code>domicilio_representante_legal</code> que ningún alias reconoce.
              Asignalos a un barrio existente o creá uno nuevo ubicándolo en el mapa.
              Cada asignación sube la cobertura del mapa de calor.
            </Nota>
            <div className="flex-1 overflow-y-auto rounded-xl border"
                 style={{ borderColor: "var(--line)", background: "var(--surface)", maxHeight: "46vh" }}>
              {pendientes.map((p) => (
                <div key={p.texto} className="border-b px-3 py-2" style={{ borderColor: "var(--line-soft)" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{p.texto}</span>
                    <span className="num shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>
                      {p.n}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <select defaultValue="" onChange={(e) => e.target.value && asignarAlias(p.texto, e.target.value)}
                            className="min-w-0 flex-1 rounded-md border px-1.5 py-1 text-[11px]"
                            style={{ borderColor: "var(--line)", background: "var(--raised)", color: "var(--ink)" }}>
                      <option value="">Asignar a…</option>
                      {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={() => setCreando({ alias: p.texto, nombre: titulo(p.texto) })}
                            className="shrink-0 rounded-md border px-2 py-1 text-[11px]"
                            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                      Nuevo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
