import { api, normalizeApiError } from "./apiClient";

// El agente expone acciones bajo /api/v1/agente/acciones/ (ver backend).
export async function chatAgente(mensaje, threadId) {
  try {
    const { data } = await api.post("/agente/acciones/chat/", {
      message: mensaje,
      thread_id: threadId,
    });
    return data;
  } catch (err) {
    throw new Error(normalizeApiError(err).message);
  }
}

export async function confirmarAccion(id, password) {
  try {
    const { data } = await api.post(`/agente/acciones/${id}/confirmar/`, { password });
    return data;
  } catch (err) {
    throw new Error(normalizeApiError(err).message);
  }
}
