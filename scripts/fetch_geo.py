"""Descarga el contorno de la isla de San Andrés desde OpenStreetMap (Overpass),
cose las líneas de costa en un anillo cerrado y lo simplifica."""
import json, math, os, urllib.request

BBOX = (12.40, -81.80, 12.65, -81.60)
OUT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "isla.geojson")
QUERY = f"""[out:json][timeout:90];
(way["natural"="coastline"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}););
out geom;"""

def fetch():
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=QUERY.encode(),
                                 headers={"User-Agent": "wisii-sanandres/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

def stitch(ways):
    """Une tramos de costa encadenando nodo final -> nodo inicial."""
    by_start = {}
    for w in ways:
        pts = [(round(g["lon"], 7), round(g["lat"], 7)) for g in w["geometry"]]
        by_start.setdefault(pts[0], []).append(pts)

    rings, consumed = [], set()
    for w in ways:
        if w["id"] in consumed:
            continue
        ring = [(round(g["lon"], 7), round(g["lat"], 7)) for g in w["geometry"]]
        consumed.add(w["id"])
        for _ in range(500):
            if ring[0] == ring[-1]:
                break
            nxt = next((c for c in by_start.get(ring[-1], []) if c != ring), None)
            if not nxt:
                break
            ring.extend(nxt[1:])
        if ring[0] == ring[-1] and len(ring) > 20:
            rings.append(ring)
    return rings

def shoelace(r):
    return abs(sum(r[i][0] * r[i+1][1] - r[i+1][0] * r[i][1] for i in range(len(r)-1)) / 2)

def rdp(pts, eps):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]; x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy)
    dmax, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy*x - dx*y + x1*y0 - y1*x0) / n if n else math.hypot(x-x0, y-y0)
        if d > dmax:
            dmax, idx = d, i
    if dmax <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)

def main():
    ways = [e for e in fetch()["elements"] if e.get("geometry")]
    rings = stitch(ways)
    if not rings:
        raise SystemExit("error: no se pudo cerrar ningún anillo de costa")

    # deduplicar (el mismo anillo se arma desde distintos tramos de partida)
    uniq, seen = [], set()
    for r in sorted(rings, key=shoelace, reverse=True):
        key = frozenset(r)
        if key not in seen:
            seen.add(key); uniq.append(r)

    main_ring = uniq[0]
    simple = rdp(main_ring, 0.00012)          # ~13 m
    if simple[0] != simple[-1]:
        simple.append(simple[0])

    lats = [p[1] for p in simple]; lons = [p[0] for p in simple]
    gj = {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "properties": {"name": "San Andrés",
                       "bbox": [min(lons), min(lats), max(lons), max(lats)]},
        "geometry": {"type": "Polygon", "coordinates": [[list(p) for p in simple]]}}]}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(gj, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

    km_ns = (max(lats) - min(lats)) * 111
    km_eo = (max(lons) - min(lons)) * 111 * math.cos(math.radians(12.55))
    print(f"anillos: {len(uniq)} | isla: {len(main_ring)} -> {len(simple)} vértices "
          f"({os.path.getsize(OUT)/1024:.0f} KB)")
    print(f"extensión: {km_ns:.1f} km N-S x {km_eo:.1f} km E-O")

if __name__ == "__main__":
    main()
