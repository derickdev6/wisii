"""Geocodifica los barrios de San Andrés contra OSM. Fuente 1: places de Overpass
(ya descargados). Fuente 2: Nominatim, 1 req/s. Lo que no se resuelve queda fuera."""
import json, time, urllib.parse, urllib.request, unicodedata, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "wisii-sanandres-contratos/1.0 (proyecto de visualizacion de datos abiertos)"

def norm(s):
    s = unicodedata.normalize('NFD', (s or '').upper())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Z0-9 ]', ' ', s)).strip()

# nombres canónicos derivados de la frecuencia real en domicilio_representante_legal
CANON = [
 "La Loma","Barrack","The Cove","Perry Hill","San Luis","Sarie Bay","Barrio Obrero",
 "Pueblo Viejo","Las Palmas","Brooks Hill","Vista Hermosa","Sound Bay","Campo Hermoso",
 "Morris Landing","School House","Back Road","Las Gaviotas","Simpson Well","Tom Hooker",
 "Rock Hole","Swamp Ground","Natania","Modelo","Los Almendros","Serranilla","San Felipe",
 "Santana","La Montaña","North End","Sprat Bight","El Bight","Punta Hansa","Orange Hill",
 "Schooner Bight","Flowers Hill","La Paz","Sagrada Familia","Los Corales","Mission Hill",
 "Little Hill","Slave Hill","Juan XXIII","Cocal","Buenos Aires","Cartagena Alegre",
 "Sunrise Park","Cove Road","Harmony Hall Hill","Mount Pleasant","Loma Cove",
]

# bbox de la isla: descarta cualquier resultado fuera de ella
LAT0, LAT1, LON0, LON1 = 12.47, 12.61, -81.74, -81.67

def from_overpass():
    p = os.path.join(HERE, "..", "data", "osm_places.json")
    if not os.path.exists(p): return {}
    out = {}
    for e in json.load(open(p))["elements"]:
        t = e.get("tags", {})
        if not t.get("name"): continue
        lat = e.get("lat") or e.get("center", {}).get("lat")
        lon = e.get("lon") or e.get("center", {}).get("lon")
        if lat and LAT0 <= lat <= LAT1 and LON0 <= lon <= LON1:
            out[norm(t["name"])] = (lat, lon, "overpass")
    return out

def nominatim(name):
    q = urllib.parse.urlencode({
        "q": f"{name}, San Andrés, San Andrés y Providencia, Colombia",
        "format": "json", "limit": 5, "viewbox": f"{LON0},{LAT1},{LON1},{LAT0}", "bounded": 1})
    req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{q}",
                                 headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            for hit in json.load(r):
                lat, lon = float(hit["lat"]), float(hit["lon"])
                if LAT0 <= lat <= LAT1 and LON0 <= lon <= LON1:
                    return lat, lon, "nominatim"
    except Exception as e:
        print(f"    ! {name}: {e}", file=sys.stderr)
    return None

ovp = from_overpass()
print(f"places de Overpass dentro de la isla: {len(ovp)}")

gaz, faltan = {}, []
for name in CANON:
    n = norm(name)
    hit = ovp.get(n)
    if not hit:  # match parcial contra los places de Overpass
        cands = [v for k, v in ovp.items() if n in k or k in n]
        hit = cands[0] if cands else None
    if not hit:
        hit = nominatim(name)
        time.sleep(1.1)
    if hit:
        gaz[name] = {"lat": round(hit[0], 5), "lon": round(hit[1], 5), "src": hit[2]}
        print(f"  ok   {name:<22} {hit[0]:.5f},{hit[1]:.5f}  [{hit[2]}]")
    else:
        faltan.append(name); print(f"  --   {name:<22} sin coordenada")

json.dump(gaz, open(os.path.join(HERE, "..", "data", "gazetteer.json"), "w"),
          ensure_ascii=False, indent=1)
print(f"\ngeocodificados: {len(gaz)}/{len(CANON)}   sin resolver: {faltan}")
