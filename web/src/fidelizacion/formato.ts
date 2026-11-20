import type { EstadoCampania } from "./tipos";

export function formatearBs(valor: string | number): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "Bs 0";
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** «2026-12-20» → «20 de diciembre». Se arma con año, mes y día para no correr la fecha por la zona horaria. */
export function fechaSorteo(iso: string | null): string {
  if (!iso) return "Por anunciar";
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return "Por anunciar";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-BO", { day: "numeric", month: "long" });
}

export const TEXTO_CANAL = { CORREO: "correo", CELULAR: "celular" } as const;

/** Texto para cuando no hay una campaña activa; vacío si está activa. */
export function mensajeSorteo(estado: EstadoCampania): string {
  switch (estado) {
    case "PAUSADA":
      return "El sorteo está en pausa. Tu tarjeta sigue aquí.";
    case "CERRADA":
      return "El sorteo terminó. ¡Gracias por participar!";
    case "SIN_CAMPANIA":
      return "El sorteo aún no empieza. Tu tarjeta ya está lista.";
    default:
      return "";
  }
}

/** Solo se enlazan términos con https (el enlace lo configura el Paseo, pero no se confía en esquemas raros). */
export function enlaceSeguro(url: string | null | undefined): string | null {
  return url && url.startsWith("https://") ? url : null;
}
