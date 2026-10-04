import { Platform } from "react-native";
import { api, normalizeApiError } from "./apiClient";

// El agente expone acciones bajo /api/v1/agente/acciones/ (ver backend).
export async function chatAgente(mensaje, threadId) {
  try {
    const { data } = await api.post("/agente/acciones/chat/", {
      message: mensaje,
      thread_id: threadId,
    }, { timeout: 45000 }); // el LLM puede tardar más que el timeout general
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

export async function rechazarAccion(id) {
  try {
    const { data } = await api.post(`/agente/acciones/${id}/rechazar/`);
    return data;
  } catch (err) {
    throw new Error(normalizeApiError(err).message);
  }
}

// Nota de voz: el backend la transcribe con Qwen Omni y responde como el chat.
// Devuelve { text, transcripcion }.
export async function enviarNotaDeVoz(uri, threadId) {
  const form = new FormData();
  if (Platform.OS === "web") {
    // En web el grabador entrega un blob: URL (audio/webm).
    const blob = await (await fetch(uri)).blob();
    form.append("audio", blob, "nota.webm");
  } else {
    const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
    form.append("audio", { uri, name: `nota.${ext}`, type: ext === "3gp" ? "audio/3gpp" : "audio/mp4" });
  }
  if (threadId) form.append("thread_id", threadId);
  try {
    const { data } = await api.post("/agente/acciones/voz/", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // transcribir + responder tarda más que un chat de texto
    });
    return data;
  } catch (err) {
    throw new Error(normalizeApiError(err).message);
  }
}
