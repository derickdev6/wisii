"""Descarga los contratos de la Gobernación de San Andrés desde datos.gov.co (SODA API).

Uso:  python3 scripts/fetch_data.py
Env:  SODA_APP_TOKEN (opcional pero recomendado; sin él aplica rate limit estricto)
"""
import csv, io, os, sys, urllib.parse, urllib.request

DATASET = "jbjy-vk9h"                 # SECOP II - Contratos Electrónicos
NIT     = "892400038"                 # GOBERNACIÓN ... SAN ANDRES PROVIDENCIA Y SANTA CATALINA
DESDE   = "2025-01-01T00:00:00.000"
CAMPO_FECHA = "fecha_de_firma"
PAGE    = 2000
OUT     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data",
                       "contratos_raw.csv")

def page(offset, token):
    params = {
        "$where":  f"nit_entidad='{NIT}' AND {CAMPO_FECHA} >= '{DESDE}'",
        "$order":  f"{CAMPO_FECHA} ASC, id_contrato ASC",
        "$limit":  PAGE,
        "$offset": offset,
    }
    if token:
        params["$$app_token"] = token
    url = f"https://www.datos.gov.co/resource/{DATASET}.csv?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read().decode("utf-8")

def main():
    token = os.environ.get("SODA_APP_TOKEN", "")
    if not token:
        print("aviso: SODA_APP_TOKEN no definido, se aplicará rate limit", file=sys.stderr)

    header, rows, offset = None, [], 0
    while True:
        rd = csv.reader(io.StringIO(page(offset, token)))
        h = next(rd, None)
        if h is None:
            break
        if header is None:
            header = h
        elif h != header:
            sys.exit(f"error: cambió el esquema del dataset en offset={offset}")
        chunk = list(rd)
        rows.extend(chunk)
        print(f"  offset={offset:<6} +{len(chunk)} filas")
        if len(chunk) < PAGE:
            break
        offset += PAGE

    # el $order garantiza determinismo, pero el dataset puede traer duplicados
    ic, seen, uniq = header.index("id_contrato"), set(), []
    for r in rows:
        if r[ic] not in seen:
            seen.add(r[ic]); uniq.append(r)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(header); w.writerows(uniq)
    print(f"\n{len(uniq)} contratos -> {os.path.relpath(OUT)}"
          f"{f' ({len(rows)-len(uniq)} duplicados descartados)' if len(rows) != len(uniq) else ''}")

if __name__ == "__main__":
    main()
