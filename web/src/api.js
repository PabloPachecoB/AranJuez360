// Cliente HTTP de la web. Los tokens viven en sessionStorage: se borran al cerrar la pestaña.
const ACCESS = "p360.access";
const REFRESH = "p360.refresh";

let onExpired = () => {};
export const setOnExpired = (fn) => { onExpired = fn; };

export const tokens = {
  get access() { return sessionStorage.getItem(ACCESS); },
  get refresh() { return sessionStorage.getItem(REFRESH); },
  set({ access, refresh }) {
    if (access) sessionStorage.setItem(ACCESS, access);
    if (refresh) sessionStorage.setItem(REFRESH, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS);
    sessionStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  constructor(status, data) {
    const campos = data && typeof data === "object" ? data : {};
    const primero = Object.entries(campos).find(([k]) => k !== "detail")?.[1];
    super(campos.detail || (Array.isArray(primero) ? primero.join(" ") : primero) || "Ocurrió un error. Intenta de nuevo.");
    this.status = status;
    this.fields = campos;
  }
}

async function refrescar() {
  if (!tokens.refresh) return false;
  const r = await fetch("/auth/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });
  if (!r.ok) return false;
  tokens.set(await r.json());
  return true;
}

export async function api(path, { method = "GET", body, reintento = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  let r;
  try {
    r = await fetch(`/api/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { detail: "No se pudo conectar con el servidor." });
  }
  if (r.status === 401 && reintento && !path.startsWith("/auth/")) {
    if (await refrescar()) return api(path, { method, body, reintento: false });
    tokens.clear();
    onExpired();
  }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, data);
  return data;
}

/** Arma ?a=1&b=2 omitiendo valores vacíos. */
export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Envío multipart (logos, portadas, fotos). `datos` es un FormData. */
export async function apiForm(path, datos, method = "PATCH", reintento = true) {
  const headers = {};
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  let r;
  try {
    r = await fetch(`/api/v1${path}`, { method, headers, body: datos });
  } catch {
    throw new ApiError(0, { detail: "No se pudo conectar con el servidor." });
  }
  if (r.status === 401 && reintento) {
    if (await refrescar()) return apiForm(path, datos, method, false);
    tokens.clear();
    onExpired();
  }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, data);
  return data;
}
