import axios from "axios";
import { API_V1_URL, REFRESH_URL } from "../constants/config";
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from "./tokenStorage";

export const api = axios.create({
  baseURL: API_V1_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// UserContext se suscribe para cerrar la sesión en pantalla cuando el refresh falla.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler || (() => {});
}

async function expireSession(error) {
  await clearTokens();
  onSessionExpired();
  return Promise.reject(error);
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token && !config.headers?.Authorization) {
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const isAuthCall = (originalRequest?.url || "").startsWith("/auth/");

    if (!originalRequest || status !== 401 || originalRequest._retry || isAuthCall) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refresh = await getRefreshToken();
    if (!refresh) return expireSession(error);

    try {
      const { data } = await axios.post(REFRESH_URL, { refresh }, { timeout: 15000 });
      if (!data?.access) return expireSession(error);
      await setAccessToken(data.access);
      originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${data.access}` };
      return api(originalRequest);
    } catch (refreshError) {
      return expireSession(refreshError);
    }
  }
);

/**
 * Convierte un error de axios/DRF en { status, message, fieldErrors }.
 * DRF devuelve errores por campo como { email: ["Ya existe..."] }.
 */
export function normalizeApiError(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const fieldErrors = {};

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [campo, valor] of Object.entries(data)) {
      if (campo === "detail") continue;
      fieldErrors[campo] = Array.isArray(valor) ? valor.join(" ") : String(valor);
    }
  }

  let message =
    data?.detail ||
    (typeof data === "string" ? data : null) ||
    Object.values(fieldErrors)[0] ||
    null;
  if (!message) {
    message = err?.response
      ? "Ocurrió un error inesperado. Intenta de nuevo."
      : "No pudimos conectar con el servidor. Revisa tu conexión.";
  }
  return { status, message, fieldErrors };
}

/** Error con los errores por campo adjuntos, para mostrarlos bajo cada input. */
export class ApiError extends Error {
  constructor(err) {
    const { status, message, fieldErrors } = normalizeApiError(err);
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}
