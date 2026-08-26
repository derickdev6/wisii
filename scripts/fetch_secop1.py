"""Descarga los contratos de la Gobernación en SECOP I (dataset f789-7hwg).

SECOP I es el sistema anterior a SECOP II. Para esta entidad cubre 2015-2022.
Dos diferencias que importan:
  - `nit_de_la_entidad` viene como "No Definido", así que la entidad solo se
    puede identificar por nombre exacto.
  - No existe ningún campo con la dirección del contratista (lo más fino es
    departamento + municipio), así que estos contratos nunca se pueden ubicar
    en el mapa de calor.
"""
import csv, json, os, sys, urllib.parse, urllib.request

DATASET = "f789-7hwg"
ENTIDAD = "SAN ANDRÉS; PROVIDENCIA Y SANTA CATALINA - GOBERNACIÓN"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "secop1_raw.csv")

# Solo las columnas que se mapean al modelo de la web: acota la consulta,
# que sobre este dataset es lenta porque nombre_entidad no está indexado.
COLS = [
    "uid", "estado_del_proceso", "tipo_de_contrato", "modalidad_de_contratacion",
    "fecha_de_firma_del_contrato", "fecha_fin_ejec_contrato",
    "nom_razon_social_contratista", "identificacion_del_contratista",
    "cuantia_contrato", "valor_contrato_con_adiciones",
    "objeto_del_contrato_a_la", "detalle_del_objeto_a_contratar",
    "plazo_de_ejec_del_contrato", "rango_de_ejec_del_contrato",
    "destino_gasto", "numero_de_constancia", "numero_de_contrato",
    "anno_firma_contrato", "dpto_y_muni_contratista",
]

def main():
    token = os.environ.get("SODA_APP_TOKEN", "")
    params = {
        "$select": ",".join(COLS),
        "$where": f"nombre_entidad='{ENTIDAD}'",
        "$order": "fecha_de_firma_del_contrato ASC, uid ASC",
        "$limit": 50000,
    }
    if token:
        params["$$app_token"] = token
    url = f"https://www.datos.gov.co/resource/{DATASET}.json?" + urllib.parse.urlencode(params)

    print("consultando SECOP I (puede tardar varios minutos)…", flush=True)
    with urllib.request.urlopen(url, timeout=600) as r:
        rows = json.load(r)
    if not rows:
        sys.exit("error: SECOP I no devolvió filas para la entidad")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        for r_ in rows:
            w.writerow({c: r_.get(c, "") for c in COLS})

    con_firma = sum(1 for r_ in rows if r_.get("fecha_de_firma_del_contrato"))
    print(f"{len(rows)} registros ({con_firma} con fecha de firma) -> {os.path.relpath(OUT)}")

if __name__ == "__main__":
    main()
