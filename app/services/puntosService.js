import { api, ApiError } from "./apiClient";

async function get(url) {
  try {
    const { data } = await api.get(url);
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

/** { saldo, recompensas_disponibles, siguiente: { nombre, faltan_puntos, faltan_bs, progreso } | null } */
export const getMonedero = () => get("/puntos/monedero/");
export const getRecompensas = () => get("/puntos/recompensas/");
export const getMovimientos = () => get("/puntos/movimientos/");

async function post(url, body) {
  try {
    const { data } = await api.post(url, body);
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

/** Qué es un código escaneado: { tipo: "COMPRA", empresa } o { tipo: "ENTRADA"|"ACTIVIDAD", punto } */
export const resolverCodigo = (codigo) => get(`/puntos/codigo/${encodeURIComponent(codigo)}/`);
/** Cobra las monedas de la puerta o de una actividad: { monedas, saldo, mensaje, disponible_de_nuevo } */
export const escanearPunto = (codigo) => post("/puntos/escanear/", { codigo });
/** Compra en un negocio: queda pendiente hasta que el cajero revise el ticket. */
export const crearSolicitud = ({ codigo, nit, monto }) => post("/puntos/solicitudes/", { codigo, nit, monto });
