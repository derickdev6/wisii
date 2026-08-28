import Link from "next/link";
import type { Meta, Recientes } from "@/lib/types";
import { leerDatos } from "@/lib/estaticos";
import { cop, copCorto, fecha, numero } from "@/lib/format";
import { ANIO, CONTACTO, FUENTES, MARCA, MARCA_SIGNIFICADO, NORMAS, RESPONSABLE } from "@/lib/legal";
import TemaToggle from "@/components/TemaToggle";
import { secopUrl } from "@/lib/format";

export const metadata = {
  title: "WiSii · Contratación pública del Archipiélago",
};

function Dato({ valor, etiqueta, nota }: { valor: string; etiqueta: string; nota?: string }) {
  return (
    <div>
      <div className="num text-2xl font-semibold leading-none sm:text-3xl">{valor}</div>
      <div className="mt-1.5 text-xs font-medium">{etiqueta}</div>
      {nota && <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{nota}</div>}
    </div>
  );
}

export default async function Portada() {
  const [meta, rec] = await Promise.all([
    leerDatos<Meta>("meta.json"),
    leerDatos<Recientes>("recientes.json"),
  ]);

  const anios = Number(meta.hasta.slice(0, 4)) - Number(meta.desde.slice(0, 4));
  // el listado abre con el rango de la ventana ya aplicado
  const urlDelMes = `/contratos?desde=${rec.desde}&hasta=${rec.hasta}&orden=valor-desc`;

  return (
    <main>
      {/* ---------- barra ---------- */}
      <header className="sticky top-0 z-40 border-b backdrop-blur"
              style={{ borderColor: "var(--line)",
                       background: "color-mix(in srgb, var(--sea) 88%, transparent)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: "var(--cta)" }} />
            {MARCA}
          </span>
          <div className="flex items-center gap-2">
            <TemaToggle />
            <Link href="/contratos"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "var(--cta)", color: "var(--cta-ink)" }}>
              Ver los contratos
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- portada ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]"
           style={{ color: "var(--cta)" }}>
          Veeduría de contratación pública
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="block text-5xl sm:text-7xl">{MARCA}</span>
          <span className="mt-3 block">
            Cada peso que contrata el Archipiélago,{" "}
            <span style={{ color: "var(--accent)" }}>a la vista de todos</span>.
          </span>
        </h1>
        <p className="mt-4 text-sm italic" style={{ color: "var(--muted)" }}>
          {MARCA_SIGNIFICADO}
        </p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
           style={{ color: "var(--ink-soft)" }}>
          La contratación de las regiones se publica, pero queda enterrada en portales
          pensados para trámites, no para leerse. Este observatorio reúne{" "}
          <strong>{numero(meta.contratos)} contratos</strong> de las {meta.entidades}{" "}
          entidades públicas del Archipiélago de San Andrés, Providencia y Santa Catalina
          — {anios} años de historia — y los vuelve consultables: se pueden buscar por
          objeto, proveedor o barrio, filtrar por entidad y período de gobierno, y ver
          dónde vive quien contrata con el Estado en las islas.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/contratos"
                className="rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:opacity-90"
                style={{ background: "var(--cta)", color: "var(--cta-ink)" }}>
            Explorar los {numero(meta.contratos)} contratos →
          </Link>
          <Link href="/contratos?v=mapa"
                className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:opacity-80"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
            Ver el mapa de calor
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4"
             style={{ borderColor: "var(--line)" }}>
          <Dato valor={numero(meta.contratos)} etiqueta="Contratos"
                nota={`${fecha(meta.desde)} – ${fecha(meta.hasta)}`} />
          <Dato valor={copCorto(meta.valor_total)} etiqueta="Valor contratado"
                nota="suma de los valores publicados" />
          <Dato valor={String(meta.entidades)} etiqueta="Entidades"
                nota={`${numero(meta.proveedores)} proveedores distintos`} />
          <Dato valor={`${(meta.geo.cobertura * 100).toFixed(1)}%`} etiqueta="Ubicados en el mapa"
                nota={`${meta.geo.barrios_ubicados} barrios de las dos islas`} />
        </div>
      </section>

      {/* ---------- último mes ---------- */}
      <section className="border-y" style={{ borderColor: "var(--line)", background: "var(--raised)" }}>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Lo firmado en el último mes
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                Entre el {fecha(rec.desde)} y el {fecha(rec.hasta)}, las entidades del
                departamento firmaron{" "}
                <strong>{numero(rec.n)} contratos</strong> con {numero(rec.proveedores)}{" "}
                proveedores distintos.
              </p>
            </div>
            <div className="rounded-xl border px-5 py-3"
                 style={{ borderColor: "var(--cta)", background: "var(--surface)" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Total contratado
              </div>
              <div className="num text-2xl font-semibold" style={{ color: "var(--cta)" }}>
                {cop(rec.valor_total)}
              </div>
            </div>
          </div>

          <ol className="mt-7 overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            {rec.contratos.slice(0, 8).map((c, i) => {
              const url = secopUrl(c.fuente, c.enlace);
              return (
                <li key={c.id} className="border-b last:border-b-0"
                    style={{ borderColor: "var(--line-soft)" }}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3.5">
                    <span className="num w-6 shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <Link href={`/contratos?c=${encodeURIComponent(c.id)}`}
                              className="text-sm font-medium underline-offset-2 hover:underline">
                          {c.proveedor}
                        </Link>
                        <span className="num text-sm font-semibold" style={{ color: "var(--cta)" }}>
                          {cop(c.valor)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug"
                         style={{ color: "var(--muted)" }}>
                        {c.objeto}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]"
                           style={{ color: "var(--muted)" }}>
                        <span className="num">{fecha(c.firma)}</span>
                        <span>·</span>
                        <span>{c.estado}</span>
                        {c.barrio && (<><span>·</span><span>{c.barrio}</span></>)}
                        <span>·</span>
                        <Link href={`/contratos?c=${encodeURIComponent(c.id)}`}
                              className="underline underline-offset-2">ver el detalle</Link>
                        {url && (
                          <>
                            <span>·</span>
                            <a href={url} target="_blank" rel="noopener noreferrer"
                               className="underline underline-offset-2">SECOP ↗</a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span style={{ color: "var(--muted)" }}>
              Se muestran los 8 de mayor valor de {numero(rec.n)}.
            </span>
            <Link href={urlDelMes}
                  className="rounded-lg px-4 py-2 font-semibold transition hover:opacity-90"
                  style={{ background: "var(--cta)", color: "var(--cta-ink)" }}>
              Ver los {numero(rec.n)} contratos del mes →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- qué hace y qué no ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cómo está hecho</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-soft)" }}>
          Un observatorio solo sirve si se puede auditar. Estas son las decisiones que
          afectan lo que ves.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              t: "Dos sistemas, una sola historia",
              d: `Une SECOP II (${numero(meta.por_fuente["SECOP II"] ?? 0)} contratos desde 2020) con ` +
                 `SECOP I (${numero(meta.por_fuente["SECOP I"] ?? 0)} desde 2015). No comparten ` +
                 `identificador: en el solape se descartaron ${meta.duplicados_descartados} registros ` +
                 `repetidos por contratista, fecha y valor.`,
            },
            {
              t: "El mapa no es dónde se ejecuta",
              d: `El SECOP no publica coordenadas y registra cada contrato en la sede de su ` +
                 `entidad. El mapa usa el domicilio del representante legal del contratista, ` +
                 `único campo con variación geográfica, y ubica el ${(meta.geo.cobertura * 100).toFixed(1)}% ` +
                 `de los que lo traen.`,
            },
            {
              t: "Lo que se deja por fuera",
              d: `Se excluyen los registros sin fecha de firma: son borradores y cancelaciones con ` +
                 `valores corruptos. Y no se grafica lo pagado, porque solo ${meta.con_pago_reportado} ` +
                 `de ${numero(meta.contratos)} contratos lo reportan.`,
            },
          ].map((c) => (
            <article key={c.t} className="rounded-xl border p-5"
                     style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <h3 className="text-sm font-semibold">{c.t}</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {c.d}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- legal ---------- */}
      <footer className="border-t" style={{ borderColor: "var(--line)", background: "var(--raised)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Origen de los datos</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Toda la información proviene de fuentes oficiales del Estado colombiano.
                El SECOP lo administra Colombia Compra Eficiente y se publica como datos
                abiertos en el portal <span className="whitespace-nowrap">datos.gov.co</span>.
                Este sitio no genera cifras propias: reorganiza y presenta lo publicado.
              </p>
              <ul className="mt-3 space-y-2">
                {FUENTES.map((f) => (
                  <li key={f.nombre} className="text-xs">
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                       className="font-medium underline underline-offset-2">{f.nombre}</a>
                    <span className="block" style={{ color: "var(--muted)" }}>{f.detalle}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Marco legal</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Los datos de contratación son información pública. Su reutilización está
                amparada por la normativa colombiana de transparencia y datos abiertos.
              </p>
              <ul className="mt-3 space-y-2">
                {NORMAS.map((n) => (
                  <li key={n.nombre} className="text-xs">
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer"
                         className="font-medium underline underline-offset-2">{n.nombre}</a>
                    ) : (
                      <span className="font-medium">{n.nombre}</span>
                    )}
                    <span className="block" style={{ color: "var(--muted)" }}>{n.detalle}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Aviso</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Sitio <strong>independiente</strong>, sin vínculo ni respaldo de la Gobernación
                del Archipiélago, de Colombia Compra Eficiente ni de ninguna entidad pública.
                Los datos se presentan tal como los publica el Estado y pueden contener errores
                u omisiones de la fuente; donde los detectamos, quedan advertidos en la
                interfaz. Esta publicación es informativa y no constituye prueba, certificación
                ni asesoría legal: para efectos oficiales consulte directamente el SECOP.
                Las visitas se miden con Vercel Web Analytics, <strong>sin cookies</strong>:
                no recoge datos personales, no construye perfiles ni rastrea entre sitios;
                solo cuenta páginas vistas de forma agregada.
                {CONTACTO && (
                  <> Para reportar un error escriba a{" "}
                    <a href={`mailto:${CONTACTO}`} className="underline underline-offset-2">{CONTACTO}</a>.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[11px]"
               style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            <p>
              © {ANIO} {RESPONSABLE}. Código, diseño y textos: todos los derechos reservados.
              Los datos públicos reutilizados no son objeto de derechos de autor y conservan
              su carácter abierto.
            </p>
            <p>
              Cartografía © colaboradores de{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank"
                 rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap</a>{" "}
              (ODbL) · Imagen satelital © Esri, Maxar, Earthstar Geographics ·
              Datos actualizados el {meta.actualizado.slice(0, 10)}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
