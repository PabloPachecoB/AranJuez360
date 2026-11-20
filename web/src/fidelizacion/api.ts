// Llamadas al API del Sorteo Paseo (/api/v1/sorteo/). Usa su propia sesión (cabecera `Tarjeta`),
// nunca los tokens de los paneles.

import { sesionSimulada } from "./simulacion";
import { sesionTarjeta } from "./sesion";
import type {
  ApiSorteo,
  CampaniaPublica,
  CodigoError,
  DatosRegistro,
  Desafio,
  RespuestaGoogleWallet,
  RespuestaVerificar,
  Tarjeta,
} from "./tipos";

const BASE = `${(import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "")}/api/v1/sorteo`;

export class SorteoApiError extends Error {
  status: number;
  codigo: CodigoError | string;
  /** Errores por campo de DRF ({campo: ["mensaje"]}). */
  campos: Record<string, string>;
  constructor(status: number, codigo: CodigoError | string, mensaje: string, campos: Record<string, string> = {}) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

function aTexto(valor: unknown): string {
  return Array.isArray(valor) ? String(valor[0] ?? "") : typeof valor === "string" ? valor : "";
}

async function pedir<T>(ruta: string, opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown; sesion?: boolean } = {}): Promise<T> {
  const { metodo = "GET", cuerpo, sesion = false } = opciones;
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (sesion) {
    const token = sesionTarjeta.obtener();
    if (token) cabeceras["Authorization"] = `Tarjeta ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new SorteoApiError(0, "red", "Sin conexión. Revisa tu internet.");
  }

  if (res.status === 204) return undefined as T;
  if (res.ok) return (await res.json()) as T;

  let datos: Record<string, unknown> = {};
  try {
    datos = (await res.json()) as Record<string, unknown>;
  } catch {
    // respuesta sin cuerpo JSON
  }
  const codigo = aTexto(datos.codigo);
  if (sesion && res.status === 401) sesionTarjeta.borrar();
  // Caída del servidor o del proxy (sin un error nuestro): se dice claro y no como «error inesperado».
  if (res.status >= 500 && !codigo) {
    throw new SorteoApiError(res.status, "servicio_no_disponible", "No disponible por ahora. Prueba en unos minutos.");
  }
  const campos: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (campo !== "detail" && campo !== "codigo") campos[campo] = aTexto(valor);
  }
  const primerCampo = Object.values(campos).find(Boolean);
  const mensaje = aTexto(datos.detail) || primerCampo || "Algo salió mal. Prueba de nuevo.";
  throw new SorteoApiError(res.status, codigo, mensaje, campos);
}

const real: ApiSorteo = {
  campania: () => pedir<CampaniaPublica>("/campania/"),
  registro: (datos: DatosRegistro) => pedir<Desafio>("/registro/", { metodo: "POST", cuerpo: datos }),
  verificar: (desafio, codigo) => pedir<RespuestaVerificar>("/verificar/", { metodo: "POST", cuerpo: { desafio, codigo } }),
  reenviar: (desafio) => pedir<Desafio>("/reenviar/", { metodo: "POST", cuerpo: { desafio } }),
  recuperar: (contacto) => pedir<Desafio>("/recuperar/", { metodo: "POST", cuerpo: { contacto } }),
  miTarjeta: () => pedir<Tarjeta>("/mi-tarjeta/", { sesion: true }),
  googleWallet: () => pedir<RespuestaGoogleWallet>("/mi-tarjeta/google-wallet/", { metodo: "POST", sesion: true }),
  cerrarSesion: () => pedir<void>("/mi-tarjeta/cerrar-sesion/", { metodo: "POST", sesion: true }),
};

/** Solo en desarrollo y con VITE_SORTEO_SIMULADO=1: datos de ejemplo sin backend. */
export const SIMULADO = import.meta.env.DEV && import.meta.env.VITE_SORTEO_SIMULADO === "1";

export const api: ApiSorteo = SIMULADO ? sesionSimulada(SorteoApiError) : real;
