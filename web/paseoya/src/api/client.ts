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

const API_BASE = "http://127.0.0.1:8001/api/v1";
const AUTH_BASE = "http://127.0.0.1:8001";

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

// Llama a `intentar`, y si el servidor responde 401, refresca el access
// token y reintenta UNA vez — misma lógica para pedidos JSON y multipart.
async function conReintento(auth: boolean, intentar: () => Promise<Response>): Promise<Response> {
  let res = await intentar();
  if (res.status === 401 && auth) {
    const refrescado = await refrescarAccessToken();
    if (refrescado) res = await intentar();
  }
  return res;
}

async function leerOtirarError<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, extraerMensaje(data));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function api<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opciones;

  const res = await conReintento(auth, () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  });

  return leerOtirarError<T>(res);
}

// Para subir archivos (fotos): usa FormData en vez de JSON. No se fija el
// Content-Type a mano — el navegador le agrega el boundary correcto solo.
export async function apiForm<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST"
): Promise<T> {
  const res = await conReintento(true, () => {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  });

  return leerOtirarError<T>(res);
}
