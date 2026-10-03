import { Platform } from "react-native";
import { createAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import { API_V1_URL } from "../constants/config";
import { getAccessToken } from "./tokenStorage";

// Si la voz neuronal del backend no carga en este tiempo, se usa la del teléfono.
const ESPERA_MAXIMA_MS = 8000;

let reproductor = null;
let suscripcion = null;
// Aviso de "terminó de hablar" de la respuesta en curso (para la animación del modo voz).
let alTerminar = null;

function avisarFin() {
  const fn = alTerminar;
  alTerminar = null;
  fn?.();
}

export function detenerVoz() {
  Speech.stop();
  suscripcion?.remove();
  suscripcion = null;
  if (reproductor) {
    reproductor.remove();
    reproductor = null;
  }
  avisarFin();
}

function esperarCarga(player) {
  if (player.isLoaded) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve(false);
    }, ESPERA_MAXIMA_MS);
    const sub = player.addListener("playbackStatusUpdate", (estado) => {
      if (estado.isLoaded) {
        clearTimeout(timer);
        sub.remove();
        resolve(true);
      }
    });
  });
}

async function fuenteDeAudio(texto) {
  const url = `${API_V1_URL}/agente/acciones/hablar/?texto=${encodeURIComponent(texto)}`;
  const token = await getAccessToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (Platform.OS !== "web") return { uri: url, headers };
  // El <audio> del navegador no envía headers: se descarga primero con el token.
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`voz ${resp.status}`);
  return URL.createObjectURL(await resp.blob());
}

// Etiquetas de emoción ([excited], [warmly]…) que la voz del teléfono leería en voz alta.
const sinEtiquetas = (texto) => texto.replace(/\[[a-zA-Z ]{2,30}\]\s*/g, "").trim();

function hablarConElTelefono(texto, onInicio, miFin) {
  // Speech avisa "detenido" de forma asíncrona: solo cierra si sigue siendo la respuesta en curso.
  const terminar = () => {
    if (alTerminar === miFin) avisarFin();
  };
  Speech.speak(sinEtiquetas(texto), {
    language: "es-ES",
    onStart: onInicio,
    onDone: terminar,
    onStopped: terminar,
    onError: terminar,
  });
}

/**
 * Jarvis lee `texto` con la voz neuronal del backend (ElevenLabs/edge-tts) o,
 * si falla, con la del teléfono. `onInicio`/`onFin` sirven para animar al avatar.
 */
export async function hablarComoJarvis(texto, { onInicio, onFin } = {}) {
  detenerVoz();
  alTerminar = onFin || null;
  const miFin = alTerminar;
  let player = null;
  try {
    player = createAudioPlayer(await fuenteDeAudio(texto));
    reproductor = player;
    const cargo = await esperarCarga(player);
    if (reproductor !== player) return; // empezó otra respuesta mientras cargaba
    if (!cargo) throw new Error("la voz tardó demasiado");
    suscripcion = player.addListener("playbackStatusUpdate", (estado) => {
      if (estado.didJustFinish) detenerVoz();
    });
    player.play();
    onInicio?.();
  } catch {
    if (reproductor && reproductor !== player) return; // otra respuesta tomó el control
    if (player) {
      player.remove();
      reproductor = null;
    }
    if (alTerminar !== miFin) return;
    hablarConElTelefono(texto, onInicio, miFin);
  }
}
