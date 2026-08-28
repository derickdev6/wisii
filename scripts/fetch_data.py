"""Descarga los contratos del departamento Archipiélago desde datos.gov.co (SODA API).

Uso:  python3 scripts/fetch_data.py
Env:  SODA_APP_TOKEN (opcional pero recomendado; sin él aplica rate limit estricto)
"""
import csv, io, os, sys, urllib.parse, urllib.request

DATASET = "jbjy-vk9h"                 # SECOP II - Contratos Electrónicos
# Todo el departamento, no solo la Gobernación: 15 entidades públicas con
# contratación propia. Se filtra por departamento y no por NIT porque hay
# municipios homónimos en otros departamentos (San Andrés de Cuerquia en
# Antioquia, San Andrés en Santander) que un filtro por nombre arrastraría.
DEPARTAMENTO = "San Andrés, Providencia y Santa Catalina"
CAMPO_FECHA = "fecha_de_firma"
PAGE    = 2000

# Se trae todo el histórico. El único filtro es exigir fecha de firma:
# los 2.265 registros sin ella están todos en estados previos a la firma
# (Borrador, Cancelado, enviado Proveedor, En aprobación) y traen valores
# corruptos — hay borradores por encima de $1.000 billones COP, mil veces
# el PIB del país. Filtrarlos por fecha elimina los dos problemas a la vez.
FILTRO = f"departamento='{DEPARTAMENTO}' AND {CAMPO_FECHA} IS NOT NULL"
OUT     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data",
                       "contratos_raw.csv")

def page(offset, token):
    params = {
        "$where":  FILTRO,
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
