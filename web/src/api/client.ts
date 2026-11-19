// Cliente HTTP mínimo para hablar con el backend Django real (JWT).
//
// Cómo funciona el flujo de autenticación:
// 1. Login normal (email+password) no da token todavía: el backend exige un
//    segundo factor por correo (ver api/auth.ts).
// 2. Al verificar el código de 6 dígitos, el backend responde con dos JWT:
//    `access` (dura 60 min, se manda en cada request) y `refresh` (dura 30
//    días, solo sirve para pedir un `access` nuevo).
// 3. Cada llamada a la API pone `Authorization: Bearer <access>`.
// 4. Si el access venció, el backend responde 401. Este cliente entonces pide
//    uno nuevo con el refresh token (POST /auth/token/refresh/) y reintenta
//    la llamada original UNA vez. Si el refresh también falla (venció a los
//    30 días, o es inválido), se cierra la sesión local.
// 5. Los tokens se guardan en localStorage para no perder la sesión al
//    recargar la página.

// Rutas relativas: en desarrollo Vite las reenvía al backend (vite.config.ts) y en el
// VPS Caddy las sirve en el mismo dominio. VITE_BACKEND_URL permite apuntar a otro host.
const AUTH_BASE = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
const API_BASE = `${AUTH_BASE}/api/v1`;

const CLAVE_ACCESS = "paseoya_access";
const CLAVE_REFRESH = "paseoya_refresh";

let accessToken: string | null = localStorage.getItem(CLAVE_ACCESS);
let refreshToken: string | null = localStorage.getItem(CLAVE_REFRESH);

export function getTokens() {
  return { accessToken, refreshToken };
}

export function setTokens(tokens: { access: string; refresh: string } | null) {
  if (tokens) {
    accessToken = tokens.access;
    refreshToken = tokens.refresh;
    localStorage.setItem(CLAVE_ACCESS, tokens.access);
    localStorage.setItem(CLAVE_REFRESH, tokens.refresh);
  } else {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem(CLAVE_ACCESS);
    localStorage.removeItem(CLAVE_REFRESH);
  }
}

export class ApiError extends Error {
  status: number;
  /** Errores por campo de DRF ({campo: ["mensaje"]}) para mostrarlos bajo cada input. */
  fields: Record<string, unknown>;
  constructor(status: number, message: string, fields: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Crea una query string omitiendo parámetros vacíos. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

async function refrescarAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${AUTH_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!res.ok) {
    setTokens(null);
    return false;
  }
  const data = await res.json();
  accessToken = data.access;
  localStorage.setItem(CLAVE_ACCESS, data.access);
  return true;
}

interface Opciones {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

function extraerMensaje(data: unknown): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    // DRF suele devolver {campo: ["mensaje"]} en errores de validación
    const primerCampo = Object.values(obj)[0];
    if (Array.isArray(primerCampo) && typeof primerCampo[0] === "string") return primerCampo[0];
  }
  return "Ocurrió un error inesperado.";
}

export async function api<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opciones;

  async function intentar(): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let res = await intentar();

  if (res.status === 401 && auth) {
    const refrescado = await refrescarAccessToken();
    if (refrescado) res = await intentar();
  }

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // respuesta sin cuerpo JSON
    }
    const campos = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    throw new ApiError(res.status, extraerMensaje(data), campos);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Envío multipart (logos, portadas, fotos). `datos` es un FormData; null para DELETE sin cuerpo. */
export async function apiForm<T>(path: string, datos: FormData | null, method: "POST" | "PATCH" | "DELETE" = "PATCH"): Promise<T> {
  const intentar = () =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: datos ?? undefined,
    });
  let res = await intentar();
  if (res.status === 401 && (await refrescarAccessToken())) res = await intentar();
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const campos = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    throw new ApiError(res.status, extraerMensaje(data), campos);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
