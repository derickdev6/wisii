"""Contornos del archipiélago desde OpenStreetMap (Overpass).

Genera data/islas.geojson con las tres islas habitadas. Providencia y Santa
Catalina están a ~90 km al NNE de San Andrés: a escala real, mostrarlas juntas
dejaría a San Andrés diminuta. Por eso el archivo guarda su geometría REAL
desplazada a un costado de San Andrés, conservando forma y tamaño verdaderos:
lo único falseado es la distancia entre islas, y la interfaz lo declara.

El desplazamiento aplicado se guarda en las propiedades para que build_data.py
pueda mover los barrios de Providencia exactamente igual.
"""
import json, math, os, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "islas.geojson")

# (nombre, isla a la que pertenece, bbox de búsqueda, km N-S esperados para validar)
GRUPOS = [
    ("San Andrés",     "San Andrés",  (12.40, -81.80, 12.65, -81.60), 12.7),
    ("Providencia",    "Providencia", (13.28, -81.44, 13.42, -81.30),  7.3),
    ("Santa Catalina", "Providencia", (13.28, -81.44, 13.42, -81.30),  1.4),
]

# separación horizontal entre San Andrés y el grupo de Providencia, en grados
HUECO = 0.014


def overpass(bbox):
    q = f'[out:json][timeout:90];(way["natural"="coastline"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););out geom;'
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=q.encode(), headers={"User-Agent": "wisii-sanandres/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return [e for e in json.load(r)["elements"] if e.get("geometry")]


def anillos(ways):
    """Cose tramos de costa encadenando nodo final -> nodo inicial."""
    by_start = {}
    for w in ways:
        pts = [(round(g["lon"], 7), round(g["lat"], 7)) for g in w["geometry"]]
        by_start.setdefault(pts[0], []).append(pts)

    out = []
    for w in ways:
        ring = [(round(g["lon"], 7), round(g["lat"], 7)) for g in w["geometry"]]
        for _ in range(500):
            if ring[0] == ring[-1]:
                break
            nxt = next((c for c in by_start.get(ring[-1], []) if c != ring), None)
            if not nxt:
                break
            ring.extend(nxt[1:])
        if ring[0] == ring[-1] and len(ring) > 15:
            out.append(ring)

    uniq, seen = [], set()
    for r in sorted(out, key=shoelace, reverse=True):
        k = frozenset(r)
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq


def shoelace(r):
    return abs(sum(r[i][0]*r[i+1][1] - r[i+1][0]*r[i][1] for i in range(len(r)-1)) / 2)


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]; x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy)
    dmax, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy*x - dx*y + x1*y0 - y1*x0) / n if n else math.hypot(x - x0, y - y0)
        if d > dmax:
            dmax, idx = d, i
    if dmax <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)


def bbox_de(anillo):
    lons = [p[0] for p in anillo]; lats = [p[1] for p in anillo]
    return min(lons), min(lats), max(lons), max(lats)


def main():
    cache, crudos = {}, {}
    for nombre, _isla, bb, _km in GRUPOS:
        if bb not in cache:
            cache[bb] = anillos(overpass(bb))
        crudos[nombre] = cache[bb]

    # San Andrés y Providencia son el anillo mayor de su bbox; Santa Catalina el segundo
    sel = {"San Andrés": crudos["San Andrés"][0],
           "Providencia": crudos["Providencia"][0],
           "Santa Catalina": crudos["Providencia"][1]}

    simple = {k: rdp(v, 0.00012) for k, v in sel.items()}
    for k, v in simple.items():
        if v[0] != v[-1]:
            v.append(v[0])

    # --- desplazamiento del grupo de Providencia ---
    sa = bbox_de(simple["San Andrés"])
    grupo = simple["Providencia"] + simple["Santa Catalina"]
    gb = bbox_de(grupo)
    dlon = (sa[2] + HUECO) - gb[0]          # a la derecha de San Andrés
    dlat = sa[3] - gb[3]                    # alineado por el borde norte
    print(f"desplazamiento aplicado a Providencia+Santa Catalina: "
          f"Δlon={dlon:+.4f}  Δlat={dlat:+.4f}")

    feats, todos = [], []
    for nombre, isla, _bb, km_esperado in GRUPOS:
        ring = simple[nombre]
        lats = [p[1] for p in ring]
        km = (max(lats) - min(lats)) * 111
        if abs(km - km_esperado) > max(1.0, km_esperado * 0.25):
            raise SystemExit(f"error: {nombre} mide {km:.1f} km N-S, se esperaban ~{km_esperado}")

        mover = isla == "Providencia"
        coords = [[p[0] + dlon, p[1] + dlat] for p in ring] if mover else [list(p) for p in ring]
        todos.extend(coords)
        feats.append({
            "type": "Feature",
            "properties": {"nombre": nombre, "isla": isla, "desplazada": mover,
                           "km_ns": round(km, 1)},
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })
        print(f"  {nombre:<16} {len(ring):>4} vértices  {km:.1f} km N-S"
              f"{'  (desplazada)' if mover else ''}")

    lons = [p[0] for p in todos]; lats = [p[1] for p in todos]
    gj = {"type": "FeatureCollection",
          "bbox": [min(lons), min(lats), max(lons), max(lats)],
          "properties": {"offsetProvidencia": [round(dlon, 6), round(dlat, 6)],
                         "nota": "Providencia y Santa Catalina conservan forma y tamaño "
                                 "reales, pero se dibujan junto a San Andrés: la distancia "
                                 "entre islas (~90 km) no está a escala."},
          "features": feats}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(gj, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\n{os.path.relpath(OUT)}: {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
