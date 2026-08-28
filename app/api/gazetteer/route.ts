import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import type { Gazetteer } from "@/lib/types";

const RUTA = path.join(process.cwd(), "data", "gazetteer.json");

// Una caja por isla: cualquier coordenada fuera de la suya es un error de captura.
const BBOX = {
  "San Andrés":  { lat: [12.44, 12.62], lon: [-81.76, -81.66] },
  Providencia:   { lat: [13.26, 13.44], lon: [-81.46, -81.28] },
} as const;

/** true cuando corre en Vercel, donde el filesystem es de solo lectura. */
const soloLectura = () => Boolean(process.env.VERCEL);

const ejecutar = promisify(execFile);

/**
 * Regenera public/data tras guardar. El mapa de calor lee barrios.json, no el
 * gazetteer, así que sin este paso una edición no se ve reflejada hasta correr
 * el script a mano. Tarda ~2 s sobre el CSV completo.
 */
async function recalcular(): Promise<string | null> {
  try {
    await ejecutar("python3", ["scripts/build_data.py"], {
      cwd: process.cwd(), timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function GET() {
  const gaz = JSON.parse(await fs.readFile(RUTA, "utf-8")) as Gazetteer;
  return NextResponse.json({ gazetteer: gaz, editable: !soloLectura() });
}

export async function POST(req: Request) {
  if (soloLectura()) {
    return NextResponse.json(
      { error: "En Vercel el filesystem es de solo lectura. Usá «Descargar» y reemplazá data/gazetteer.json en el repo." },
      { status: 403 },
    );
  }

  let body: Gazetteer;
  try {
    body = (await req.json()) as Gazetteer;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body?.barrios || !body?.alias) {
    return NextResponse.json({ error: "Faltan las claves 'barrios' y 'alias'" }, { status: 400 });
  }

  for (const [nombre, b] of Object.entries(body.barrios)) {
    // lat/lon en null = barrio reconocido cuya ubicación todavía no se conoce
    if (b?.lat == null && b?.lon == null) continue;
    if (typeof b?.lat !== "number" || typeof b?.lon !== "number") {
      return NextResponse.json(
        { error: `'${nombre}' debe tener lat y lon numéricos, o ambos en null` },
        { status: 400 });
    }
    const isla = (b.isla ?? "San Andrés") as keyof typeof BBOX;
    const caja = BBOX[isla];
    if (!caja) {
      return NextResponse.json({ error: `'${nombre}' tiene una isla desconocida: ${b.isla}` }, { status: 400 });
    }
    if (b.lat < caja.lat[0] || b.lat > caja.lat[1] || b.lon < caja.lon[0] || b.lon > caja.lon[1]) {
      return NextResponse.json(
        { error: `'${nombre}' queda fuera de ${isla} (${b.lat}, ${b.lon})` }, { status: 400 });
    }
  }

  const huerfanos = Object.entries(body.alias).filter(([, b]) => !body.barrios[b]);
  if (huerfanos.length) {
    return NextResponse.json(
      { error: `Alias apuntan a barrios inexistentes: ${huerfanos.map(([a, b]) => `${a}→${b}`).join(", ")}` },
      { status: 400 });
  }

  await fs.writeFile(RUTA, JSON.stringify(body, null, 1) + "\n", "utf-8");

  const fallo = await recalcular();
  const sinUbicar = Object.values(body.barrios)
    .filter((b) => b.lat == null || b.lon == null).length;

  return NextResponse.json({
    ok: true,
    barrios: Object.keys(body.barrios).length,
    alias: Object.keys(body.alias).length,
    sinUbicar,
    recalculado: fallo === null,
    error: fallo,
  });
}
