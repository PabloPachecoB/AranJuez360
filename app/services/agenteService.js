import { Platform } from "react-native";
import { api, normalizeApiError } from "./apiClient";

function lanzarErrorAgente(err) {
  const { status, message } = normalizeApiError(err);
  const esTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
  const error = new Error(esTimeout ? "La solicitud tardó más de lo esperado. Intenta de nuevo." : message);
  error.status = status;
  throw error;
}

export async function listarConversaciones() {
  try {
    let url = "/agente/conversaciones/";
    const conversaciones = [];
    while (url) {
      const { data } = await api.get(url);
      if (Array.isArray(data)) return data;
      conversaciones.push(...(data?.results || []));
      url = data?.next || null;
    }
    return conversaciones;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function crearConversacion(titulo) {
  try {
    const { data } = await api.post("/agente/conversaciones/", titulo ? { titulo } : {});
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function listarMensajesConversacion(conversationId) {
  try {
    const { data } = await api.get(`/agente/conversaciones/${conversationId}/mensajes/`);
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function archivarConversacion(conversationId) {
  try {
    await api.delete(`/agente/conversaciones/${conversationId}/`);
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function listarAccionesConversacion(conversationId) {
  try {
    const { data } = await api.get("/agente/acciones/", { params: { conversation_id: conversationId } });
    return Array.isArray(data) ? data : (data?.results || []);
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function chatAgente(mensaje, conversationId) {
  try {
    const cuerpo = { message: mensaje };
    if (conversationId) cuerpo.conversation_id = conversationId;
    const { data } = await api.post("/agente/acciones/chat/", cuerpo, { timeout: 45000 });
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function confirmarAccion(id, password) {
  try {
    const { data } = await api.post(`/agente/acciones/${id}/confirmar/`, { password });
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function rechazarAccion(id) {
  try {
    const { data } = await api.post(`/agente/acciones/${id}/rechazar/`);
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}

export async function enviarNotaDeVoz(uri, conversationId) {
  try {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("audio", blob, "nota.webm");
    } else {
      const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
      const tiposAudio = {
        "3gp": "audio/3gpp", aac: "audio/aac", m4a: "audio/mp4", mp3: "audio/mpeg",
        mp4: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", webm: "audio/webm",
      };
      form.append("audio", { uri, name: `nota.${ext}`, type: tiposAudio[ext] || "audio/mp4" });
    }
    if (conversationId) form.append("conversation_id", conversationId);
    const { data } = await api.post("/agente/acciones/voz/", form, {
      timeout: 60000,
    });
    return data;
  } catch (err) {
    return lanzarErrorAgente(err);
  }
}
