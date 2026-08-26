const COP = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
});

/** $1.234.567 completo. Para tablas y detalle. */
export const cop = (n: number) => COP.format(n);

/** $12,5 MM — para tarjetas y ejes donde el dígito exacto no aporta. */
export function copCorto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(1).replace(".", ",")} B`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1).replace(".", ",")} MMM`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1).replace(".", ",")} MM`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)} K`;
  return `$${n}`;
}

export const numero = (n: number) => new Intl.NumberFormat("es-CO").format(n);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2025-03-14" -> "14 mar 2025" */
export function fecha(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`;
}

/** "2025-03" -> "mar 2025" */
export function mes(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

/** Cada sistema tiene su propio detalle público. */
export function secopUrl(fuente: string, enlace: string): string | null {
  if (!enlace) return null;
  return fuente === "SECOP I"
    ? `https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=${enlace}`
    : `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${enlace}&isFromPublicArea=True&isModal=False`;
}
