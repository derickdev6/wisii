"""Convierte los CSV crudos + el gazetteer en los JSON que consume la web.

Une dos fuentes con esquemas distintos bajo un modelo común:
  SECOP II (jbjy-vk9h)  2020-2026  — trae domicilio del contratista, se puede mapear
  SECOP I  (f789-7hwg)  2015-2022  — sin dirección del contratista, nunca se mapea

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

SECOP2, SECOP1 = "SECOP II", "SECOP I"


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
    except (ValueError, TypeError):
        return 0


def canonicalizar(rows, campo):
    """Los dos sistemas escriben los mismos valores con distinta capitalización
    ('Prestación de servicios' vs 'Prestación de Servicios'), lo que partiría los
    filtros en dos. Se unifica al deletreo más frecuente. Valores realmente
    distintos ('Cerrado' vs 'Celebrado') no se tocan."""
    grupos = defaultdict(Counter)
    for r in rows:
        grupos[r[campo].casefold()][r[campo]] += 1
    canon = {k: c.most_common(1)[0][0] for k, c in grupos.items()}
    fusionados = sum(1 for c in grupos.values() if len(c) > 1)
    for r in rows:
        r[campo] = canon[r[campo].casefold()]
    return fusionados


def dictify(values):
    uniq = sorted({v for v in values})
    return uniq, {v: i for i, v in enumerate(uniq)}


def prefijo_comun(vals):
    """Prefijo compartido por todos los valores no vacíos. Se guarda una vez
    en meta y se recorta de cada fila."""
    vals = [v for v in vals if v]
    if not vals:
        return ""
    p = vals[0]
    for v in vals:
        while not v.startswith(p):
            p = p[:-1]
            if not p:
                return ""
    return p


d10 = lambda v: (v or "")[:10]
NOTICE = re.compile(r"noticeUID=([A-Za-z0-9._-]+)")


def leer_secop2(path):
    """SECOP II -> modelo común."""
    out = []
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        m = NOTICE.search(r.get("urlproceso") or "")
        out.append({
            "fuente": SECOP2,
            "id": r["id_contrato"],
            "estado": r["estado_contrato"],
            "tipo": r["tipo_de_contrato"],
            "modalidad": r["modalidad_de_contratacion"],
            "firma": d10(r["fecha_de_firma"]),
            "fin": d10(r["fecha_de_fin_del_contrato"]),
            "proveedor": r["proveedor_adjudicado"],
            "documento": r["documento_proveedor"],
            "valor": to_int(r["valor_del_contrato"]),
            "pagado": to_int(r["valor_pagado"]),
            "objeto": r["objeto_del_contrato"],
            "duracion": r["duraci_n_del_contrato"],
            "domicilio": r["domicilio_representante_legal"],
            "origen": r["origen_de_los_recursos"],
            "destino": r["destino_gasto"],
            "enlace": m.group(1) if m else "",
        })
    return out


RANGOS = {"M": "Mes(es)", "D": "Día(s)", "A": "Año(s)", "S": "Semana(s)"}


def leer_secop1(path):
    """SECOP I -> modelo común. Sin domicilio: estos contratos no se mapean."""
    out = []
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        firma = d10(r.get("fecha_de_firma_del_contrato"))
        if not firma:
            continue                      # sin firma no es un contrato celebrado
        plazo = (r.get("plazo_de_ejec_del_contrato") or "").strip()
        rango = RANGOS.get((r.get("rango_de_ejec_del_contrato") or "").strip().upper(), "")
        out.append({
            "fuente": SECOP1,
            "id": r["uid"],
            "estado": r.get("estado_del_proceso") or "No definido",
            "tipo": r.get("tipo_de_contrato") or "No definido",
            "modalidad": r.get("modalidad_de_contratacion") or "No definido",
            "firma": firma,
            "fin": d10(r.get("fecha_fin_ejec_contrato")),
            "proveedor": r.get("nom_razon_social_contratista") or "No definido",
            "documento": r.get("identificacion_del_contratista") or "",
            # el análogo de valor_del_contrato es el valor con adiciones
            "valor": to_int(r.get("valor_contrato_con_adiciones")) or to_int(r.get("cuantia_contrato")),
            "pagado": 0,                  # SECOP I no publica ejecución de pagos
            "objeto": (r.get("objeto_del_contrato_a_la")
                       or r.get("detalle_del_objeto_a_contratar") or ""),
            "duracion": f"{plazo} {rango}".strip() if plazo else "",
            "domicilio": "",              # SECOP I no tiene dirección del contratista
            "origen": "No definido",
            "destino": r.get("destino_gasto") or "No definido",
            "enlace": r.get("numero_de_constancia") or "",
        })
    return out


def main():
    src2 = os.path.join(DATA, "contratos_raw.csv")
    if not os.path.exists(src2):
        sys.exit("error: falta data/contratos_raw.csv — corré antes scripts/fetch_data.py")
    rows = leer_secop2(src2)
    n2 = len(rows)

    src1 = os.path.join(DATA, "secop1_raw.csv")
    n1 = dup = 0
    if os.path.exists(src1):
        viejos = leer_secop1(src1)
        # Los dos sistemas no comparten identificador. En el solape de 2020 un mismo
        # contrato podría figurar en ambos, así que se descarta por huella
        # (documento del contratista + fecha de firma + valor).
        huella = {(r["documento"], r["firma"], r["valor"]) for r in rows}
        for r in viejos:
            k = (r["documento"], r["firma"], r["valor"])
            if k in huella:
                dup += 1
            else:
                huella.add(k)
                rows.append(r)
        n1 = len(viejos) - dup
    rows.sort(key=lambda r: (r["firma"], r["id"]))

    fus = {c: canonicalizar(rows, c) for c in ("tipo", "modalidad", "estado", "destino")}
    if any(fus.values()):
        print("  valores unificados por capitalización: " +
              ", ".join(f"{k}={v}" for k, v in fus.items() if v))

    gaz = json.load(open(os.path.join(DATA, "gazetteer.json"), encoding="utf-8"))
    barrios_geo, alias = gaz["barrios"], gaz["alias"]
    match = make_matcher(alias)

    # --- geocodificación por barrio de domicilio del contratista ---
    asignado = [match(r["domicilio"]) for r in rows]
    # el denominador honesto son los contratos que traen el campo (solo SECOP II)
    mapeables = [r for r in rows if r["fuente"] == SECOP2]
    con_barrio = sum(1 for b in asignado if b)
    sin_dato = sum(1 for r in mapeables if norm(r["domicilio"]) in VACIO)
    no_match = sum(1 for r, b in zip(rows, asignado)
                   if r["fuente"] == SECOP2 and b is None and norm(r["domicilio"]) not in VACIO)

    # --- diccionarios ---
    fuentes,  i_fuente  = dictify(r["fuente"] for r in rows)
    estados,  i_estado  = dictify(r["estado"] for r in rows)
    tipos,    i_tipo    = dictify(r["tipo"] for r in rows)
    modals,   i_modal   = dictify(r["modalidad"] for r in rows)
    origenes, i_origen  = dictify(r["origen"] for r in rows)
    destinos, i_destino = dictify(r["destino"] for r in rows)
    provs,    i_prov    = dictify(r["proveedor"] for r in rows)
    objetos,  i_objeto  = dictify(r["objeto"] for r in rows)
    domis,    i_domi    = dictify(r["domicilio"] for r in rows)
    duras,    i_dura    = dictify(r["duracion"] for r in rows)
    b_names = sorted(barrios_geo)
    i_barrio = {b: i for i, b in enumerate(b_names)}

    # Prefijo constante por fuente: los ids de SECOP II comparten "CO1.PCCNTR.",
    # los de SECOP I no comparten ninguno. Se guarda un prefijo por fuente para
    # que el cliente pueda reconstruir el id sin ambigüedad.
    pref_por_fuente = {
        f: prefijo_comun([r["id"] for r in rows if r["fuente"] == f]) for f in fuentes
    }
    corta = lambda v, p: v[len(p):] if p and v.startswith(p) else v

    contratos = [[
        corta(r["id"], pref_por_fuente[r["fuente"]]),
        i_fuente[r["fuente"]],
        i_estado[r["estado"]],
        i_tipo[r["tipo"]],
        i_modal[r["modalidad"]],
        r["firma"], r["fin"],
        i_prov[r["proveedor"]],
        r["documento"],
        r["valor"], r["pagado"],
        i_objeto[r["objeto"]],
        i_dura[r["duracion"]],
        i_barrio.get(b, -1),
        i_domi[r["domicilio"]],
        i_origen[r["origen"]],
        i_destino[r["destino"]],
        r["enlace"],
    ] for r, b in zip(rows, asignado)]

    CAMPOS = ["id","fuente","estado","tipo","modalidad","firma","fin","proveedor","documento",
              "valor","pagado","objeto","duracion","barrio","domicilio","origen","destino","enlace"]

    os.makedirs(OUTDIR, exist_ok=True)
    json.dump({"campos": CAMPOS,
               "pref": pref_por_fuente,
               "dic": {"fuente": fuentes, "estado": estados, "tipo": tipos,
                       "modalidad": modals, "proveedor": provs, "origen": origenes,
                       "destino": destinos, "barrio": b_names, "objeto": objetos,
                       "duracion": duras, "domicilio": domis},
               "filas": contratos},
              open(os.path.join(OUTDIR, "contratos.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    # --- agregado por barrio (una feature por barrio; el peso lo da el heatmap) ---
    agg = defaultdict(lambda: {"n": 0, "valor": 0})
    for r, b in zip(rows, asignado):
        if b:
            agg[b]["n"] += 1
            agg[b]["valor"] += r["valor"]

    # Providencia se dibuja junto a San Andrés (ver scripts/fetch_geo.py): los
    # barrios de esa isla se desplazan con el mismo vector para que caigan sobre
    # su polígono. Las coordenadas reales siguen en data/gazetteer.json, que es
    # lo que usa el editor sobre imagen satelital.
    islas = json.load(open(os.path.join(DATA, "islas.geojson"), encoding="utf-8"))
    dlon, dlat = islas["properties"]["offsetProvidencia"]

    feats = []
    for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["n"]):
        g = barrios_geo[b]
        mover = g.get("isla") == "Providencia"
        feats.append({
            "type": "Feature",
            "properties": {"barrio": b, "n": a["n"], "valor": a["valor"],
                           "src": g["src"], "isla": g.get("isla", "San Andrés")},
            "geometry": {"type": "Point",
                         "coordinates": [round(g["lon"] + (dlon if mover else 0), 6),
                                         round(g["lat"] + (dlat if mover else 0), 6)]},
        })
    json.dump({"type": "FeatureCollection", "features": feats},
              open(os.path.join(OUTDIR, "barrios.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    json.dump(islas, open(os.path.join(OUTDIR, "islas.geojson"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    # --- meta ---
    valores = sorted(r["valor"] for r in rows)
    valor_total = sum(valores)
    firmas = sorted(r["firma"] for r in rows)
    aprox = sum(1 for b in agg if barrios_geo[b]["src"] == "aprox")
    meta = {
        "actualizado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entidad": "GOBERNACIÓN DEL DEPARTAMENTO ARCHIPIELAGO DE SAN ANDRES "
                   "PROVIDENCIA Y SANTA CATALINA",
        "nit": "892400038",
        "fuente": "datos.gov.co · SECOP II (jbjy-vk9h) y SECOP I (f789-7hwg)",
        "contratos": len(rows),
        "por_fuente": {SECOP2: n2, SECOP1: n1},
        "duplicados_descartados": dup,
        "valor_total": valor_total,
        "valor_mediano": valores[len(valores) // 2],
        "valor_pagado": sum(r["pagado"] for r in rows),
        "con_pago_reportado": sum(1 for r in rows if r["pagado"] > 0),
        "proveedores": len({r["documento"] for r in rows if r["documento"]}),
        "desde": firmas[0], "hasta": firmas[-1],
        "por_mes": dict(sorted(Counter(f[:7] for f in firmas).items())),
        "geo": {
            "con_barrio": con_barrio,
            "mapeables": len(mapeables),        # solo SECOP II trae domicilio
            "sin_dato": sin_dato,
            "no_reconocido": no_match,
            "cobertura": round(con_barrio / len(mapeables), 4) if mapeables else 0,
            "cobertura_total": round(con_barrio / len(rows), 4),
            "barrios_ubicados": len(agg),
            "barrios_aprox": aprox,
            "por_isla": {
                isla: {
                    "barrios": sum(1 for b in agg if barrios_geo[b].get("isla") == isla),
                    "contratos": sum(a["n"] for b, a in agg.items()
                                     if barrios_geo[b].get("isla") == isla),
                } for isla in ("San Andrés", "Providencia")
            },
        },
        "pendientes": [
            {"texto": t, "n": n} for t, n in Counter(
                norm(r["domicilio"]) for r, b in zip(rows, asignado)
                if b is None and norm(r["domicilio"]) not in VACIO).most_common(150)],
        "por_barrio": {b: a["n"] for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["n"])},
    }
    json.dump(meta, open(os.path.join(OUTDIR, "meta.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))

    kb = lambda p: os.path.getsize(os.path.join(OUTDIR, p)) / 1024
    print(f"SECOP II       {n2:>6}")
    print(f"SECOP I        {n1:>6}" + (f"   ({dup} duplicados descartados)" if dup else ""))
    print(f"total          {len(rows):>6}   {kb('contratos.json'):>7.0f} KB")
    print(f"barrios        {len(agg):>6}   {kb('barrios.json'):>7.0f} KB")
    print(f"\nrango: {firmas[0]} -> {firmas[-1]}")
    print(f"cobertura sobre mapeables (SECOP II): {con_barrio}/{len(mapeables)} "
          f"({con_barrio/len(mapeables):.1%})")
    print(f"cobertura sobre el total:             {con_barrio}/{len(rows)} "
          f"({con_barrio/len(rows):.1%})")


if __name__ == "__main__":
    main()
