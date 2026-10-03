const nf = new Intl.NumberFormat("es-BO");
const compacto = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });

export const num = (v) => nf.format(Number(v) || 0);
export const bs = (v) => `Bs ${nf.format(Math.round(Number(v) || 0))}`;
export const corto = (v) => (Math.abs(Number(v)) >= 10000 ? compacto.format(Number(v)) : nf.format(Number(v) || 0));

export function fecha(iso, conHora = false) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function hace(iso) {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** Fecha local YYYY-MM-DD (no UTC). */
export function isoLocal(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export const ROLES = {
  ADMIN: "Administrador",
  PORTERO: "Portero",
  CLIENTE: "Cliente",
  NEGOCIO: "Negocio",
  CAJERO: "Cajero",
  OFICINA: "Oficina",
};
export const TIPOS = { NEGOCIO: "Negocio", EMPRENDIMIENTO: "Emprendimiento", OFICINA: "Oficina" };
