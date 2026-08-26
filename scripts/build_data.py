"""Convierte el CSV crudo + el gazetteer en los JSON que consume la web.

Salida en public/data/:
  contratos.json  contratos codificados con diccionarios (compacto)
  barrios.json    agregado por barrio, con peso para el mapa de calor
  meta.json       totales, cobertura geográfica y fecha de actualización
"""
import csv, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone

HERE   = os.path.dirname(os.path.abspath(__file__))
DATA   = os.path.join(HERE, "..", "data")
OUTDIR = os.path.join(HERE, "..", "public", "data")

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", s)).strip()

VACIO = {"", "NO DEFINIDO", "SAN ANDRES", "SAN ANDRES ISLA", "SAN ANDRES ISLAS",
         "ISLA", "COLOMBIA", "NA", "N A", "SIN DATO", "X", "0"}

def make_matcher(alias):
    """Alias ordenados por longitud desc: gana la coincidencia más específica.
    Se exige límite de palabra para no confundir 'TANA' dentro de 'LA MONTANA'."""
    pats = [(re.compile(rf"(?<![A-Z0-9]){re.escape(a)}(?![A-Z0-9])"), barrio)
            for a, barrio in sorted(alias.items(), key=lambda kv: -len(kv[0]))]
    def match(domicilio):
        d = norm(domicilio)
        if d in VACIO:
            return None
        for pat, barrio in pats:
            if pat.search(d):
                return barrio
        return None
    return match

def to_int(v):
    try:
        return int(float(v or 0))
    except ValueError:
        return 0

def dictify(values):
    """Devuelve (lista de valores únicos, función valor->índice)."""
    uniq = sorted({v for v in values})
    idx = {v: i for i, v in enumerate(uniq)}
    return uniq, idx

NOTICE = re.compile(r"noticeUID=([A-Za-z0-9._-]+)")

def main():
    src = os.path.join(DATA, "contratos_raw.csv")
    if not os.path.exists(src):
        legacy = os.path.join(DATA, "GOBERNACION_SAN_ANDRES_contratos_desde_2025-01-01.csv")
        if os.path.exists(legacy):
            src = legacy
        else:
            sys.exit("error: falta data/contratos_raw.csv — corré antes scripts/fetch_data.py")

    rows = list(csv.DictReader(open(src, encoding="utf-8-sig")))
    gaz  = json.load(open(os.path.join(DATA, "gazetteer.json"), encoding="utf-8"))
    barrios_geo, alias = gaz["barrios"], gaz["alias"]
    match = make_matcher(alias)

    # --- geocodificación por barrio de domicilio del contratista ---
    asignado = [match(r["domicilio_representante_legal"]) for r in rows]
    sin_dato = sum(1 for r in rows if norm(r["domicilio_representante_legal"]) in VACIO)
    no_match = sum(1 for r, b in zip(rows, asignado)
                   if b is None and norm(r["domicilio_representante_legal"]) not in VACIO)
    con_barrio = sum(1 for b in asignado if b)

    # --- diccionarios ---
    estados,   i_estado   = dictify(r["estado_contrato"] for r in rows)
    tipos,     i_tipo     = dictify(r["tipo_de_contrato"] for r in rows)
    modals,    i_modal    = dictify(r["modalidad_de_contratacion"] for r in rows)
    origenes,  i_origen   = dictify(r["origen_de_los_recursos"] for r in rows)
    destinos,  i_destino  = dictify(r["destino_gasto"] for r in rows)
    provs,     i_prov     = dictify(r["proveedor_adjudicado"] for r in rows)
    b_names = sorted(barrios_geo)
    i_barrio = {b: i for i, b in enumerate(b_names)}

    def fecha(v):
        return (v or "")[:10]

    contratos = []
    for r, b in zip(rows, asignado):
        m = NOTICE.search(r.get("urlproceso") or "")
        contratos.append([
            r["id_contrato"],
            r["referencia_del_contrato"],
            i_estado[r["estado_contrato"]],
            i_tipo[r["tipo_de_contrato"]],
            i_modal[r["modalidad_de_contratacion"]],
            fecha(r["fecha_de_firma"]),
            fecha(r["fecha_de_fin_del_contrato"]),
            i_prov[r["proveedor_adjudicado"]],
            r["documento_proveedor"],
            to_int(r["valor_del_contrato"]),
            to_int(r["valor_pagado"]),
            r["objeto_del_contrato"],
            r["duraci_n_del_contrato"],
            i_barrio.get(b, -1),
            r["domicilio_representante_legal"],
            i_origen[r["origen_de_los_recursos"]],
            i_destino[r["destino_gasto"]],
            m.group(1) if m else "",
        ])

    CAMPOS = ["id","ref","estado","tipo","modalidad","firma","fin","proveedor","documento",
              "valor","pagado","objeto","duracion","barrio","domicilio","origen","destino","notice"]

    os.makedirs(OUTDIR, exist_ok=True)
    json.dump({"campos": CAMPOS,
               "dic": {"estado": estados, "tipo": tipos, "modalidad": modals,
                       "proveedor": provs, "origen": origenes, "destino": destinos,
                       "barrio": b_names},
               "filas": contratos},
              open(os.path.join(OUTDIR, "contratos.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    # --- agregado por barrio (una feature por barrio; el peso lo da el heatmap) ---
    agg = defaultdict(lambda: {"n": 0, "valor": 0})
    for r, b in zip(rows, asignado):
        if b:
            agg[b]["n"] += 1
            agg[b]["valor"] += to_int(r["valor_del_contrato"])

    feats = []
    for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["n"]):
        g = barrios_geo[b]
        feats.append({"type": "Feature",
                      "properties": {"barrio": b, "n": a["n"], "valor": a["valor"],
                                     "src": g["src"]},
                      "geometry": {"type": "Point", "coordinates": [g["lon"], g["lat"]]}})
    json.dump({"type": "FeatureCollection", "features": feats},
              open(os.path.join(OUTDIR, "barrios.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    # --- isla ---
    with open(os.path.join(DATA, "isla.geojson"), encoding="utf-8") as f:
        json.dump(json.load(f), open(os.path.join(OUTDIR, "isla.geojson"), "w"),
                  ensure_ascii=False, separators=(",", ":"))

    # --- meta ---
    firmas = sorted(fecha(r["fecha_de_firma"]) for r in rows)
    por_mes = Counter(f[:7] for f in firmas)
    valores = sorted(to_int(r["valor_del_contrato"]) for r in rows)
    valor_total = sum(valores)
    valor_mediano = valores[len(valores) // 2]
    # valor_pagado casi no se reporta en este dataset: se mide para poder advertirlo
    con_pago = sum(1 for r in rows if to_int(r["valor_pagado"]) > 0)
    aprox = sum(1 for b, a in agg.items() if barrios_geo[b]["src"] == "aprox")
    meta = {
        "actualizado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entidad": rows[0]["nombre_entidad"], "nit": rows[0]["nit_entidad"],
        "fuente": "datos.gov.co · SECOP II · dataset jbjy-vk9h",
        "contratos": len(rows),
        "valor_total": valor_total,
        "valor_mediano": valor_mediano,
        "valor_pagado": sum(to_int(r["valor_pagado"]) for r in rows),
        "con_pago_reportado": con_pago,
        "proveedores": len({r["documento_proveedor"] for r in rows}),
        "desde": firmas[0], "hasta": firmas[-1],
        "por_mes": dict(sorted(por_mes.items())),
        "geo": {"con_barrio": con_barrio, "sin_dato": sin_dato, "no_reconocido": no_match,
                "cobertura": round(con_barrio / len(rows), 4),
                "barrios_ubicados": len(agg), "barrios_aprox": aprox},
        # domicilios que no matchearon ningún alias: insumo del editor de barrios
        "pendientes": [
            {"texto": t, "n": n} for t, n in Counter(
                norm(r["domicilio_representante_legal"])
                for r, b in zip(rows, asignado)
                if b is None and norm(r["domicilio_representante_legal"]) not in VACIO
            ).most_common(150)
        ],
        # contratos por barrio, para priorizar en el editor
        "por_barrio": {b: a["n"] for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["n"])},
    }
    json.dump(meta, open(os.path.join(OUTDIR, "meta.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    kb = lambda p: os.path.getsize(os.path.join(OUTDIR, p)) / 1024
    print(f"contratos      {len(rows):>6}   {kb('contratos.json'):>7.0f} KB")
    print(f"barrios        {len(agg):>6}   {kb('barrios.json'):>7.0f} KB")
    print(f"isla                      {kb('isla.geojson'):>7.0f} KB")
    print(f"\ncobertura geográfica: {con_barrio}/{len(rows)} ({con_barrio/len(rows):.1%})")
    print(f"  sin domicilio útil : {sin_dato} ({sin_dato/len(rows):.1%})")
    print(f"  no reconocido      : {no_match} ({no_match/len(rows):.1%})")
    print(f"  barrios aprox      : {aprox}/{len(agg)}")

    if no_match:
        faltan = Counter(norm(r["domicilio_representante_legal"])
                         for r, b in zip(rows, asignado)
                         if b is None and norm(r["domicilio_representante_legal"]) not in VACIO)
        print("\n  top domicilios sin reconocer:")
        for v, n in faltan.most_common(15):
            print(f"    {n:4d}  {v[:64]}")

if __name__ == "__main__":
    main()
