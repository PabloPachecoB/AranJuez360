const nf = new Intl.NumberFormat("es-BO");
const compacto = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });

export const num = (value: unknown) => nf.format(Number(value) || 0);
export const bs = (value: unknown) => `Bs ${nf.format(Math.round(Number(value) || 0))}`;
export const corto = (value: unknown) =>
  Math.abs(Number(value)) >= 10_000 ? compacto.format(Number(value)) : nf.format(Number(value) || 0);

export function fecha(iso: string | null | undefined, conHora = false) {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return date.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function hace(iso: string | null | undefined) {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** Fecha local YYYY-MM-DD (no UTC). */
export function isoLocal(date: Date) {
  const z = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export const ROLES: Record<string, string> = {
  ADMIN: "Administrador",
  PORTERO: "Portero",
  CLIENTE: "Cliente",
  NEGOCIO: "Negocio",
  CAJERO: "Cajero",
  OFICINA: "Oficina",
};

export const TIPOS: Record<string, string> = {
  NEGOCIO: "Negocio",
  EMPRENDIMIENTO: "Emprendimiento",
  OFICINA: "Oficina",
};
