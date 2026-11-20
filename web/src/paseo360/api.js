// Puente: las pantallas de Paseo 360 usan el mismo cliente HTTP y la misma sesión
// (tokens en localStorage) que el resto del panel (src/api/client.ts).
import { ApiError, api as apiCliente, apiForm, qs, setTokens } from "../api/client";

export { ApiError, apiForm, qs };

/** api(path, { method, body }) → mismo contrato que usaban estas pantallas. */
export function api(path, { method = "GET", body, auth = true } = {}) {
  return apiCliente(path, { method, body, auth });
}

export const tokens = { clear: () => setTokens(null) };
