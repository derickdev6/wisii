import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Gazetteer } from "@/lib/types";

const RUTA = path.join(process.cwd(), "data", "gazetteer.json");

// La isla completa. Cualquier coordenada fuera de aquí es un error de captura.
const BBOX = { lat: [12.44, 12.62], lon: [-81.76, -81.66] } as const;

/** true cuando corre en Vercel, donde el filesystem es de solo lectura. */
const soloLectura = () => Boolean(process.env.VERCEL);

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
    if (typeof b?.lat !== "number" || typeof b?.lon !== "number") {
      return NextResponse.json({ error: `'${nombre}' no tiene lat/lon numéricos` }, { status: 400 });
    }
    if (b.lat < BBOX.lat[0] || b.lat > BBOX.lat[1] || b.lon < BBOX.lon[0] || b.lon > BBOX.lon[1]) {
      return NextResponse.json(
        { error: `'${nombre}' queda fuera de la isla (${b.lat}, ${b.lon})` }, { status: 400 });
    }
  }

  const huerfanos = Object.entries(body.alias).filter(([, b]) => !body.barrios[b]);
  if (huerfanos.length) {
    return NextResponse.json(
      { error: `Alias apuntan a barrios inexistentes: ${huerfanos.map(([a, b]) => `${a}→${b}`).join(", ")}` },
      { status: 400 });
  }

  await fs.writeFile(RUTA, JSON.stringify(body, null, 1) + "\n", "utf-8");
  return NextResponse.json({
    ok: true,
    barrios: Object.keys(body.barrios).length,
    alias: Object.keys(body.alias).length,
  });
}
