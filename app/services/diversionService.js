import { api, ApiError } from "./apiClient";

async function llamar(metodo, url, body) {
  try {
    const { data } = await api.request({ method: metodo, url, data: body });
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

const lista = (data) => data?.results ?? data ?? [];

/** { cartelera: [película + funciones], eventos, destacado, actividades } */
export const getDiversion = () => llamar("get", "/entretenimiento/");

// ---------- Escenario abierto ----------
/** Espacios del Paseo que se pueden pedir para presentarse. */
export const getEspacios = async () => lista(await llamar("get", "/entretenimiento/espacios/"));
/** Mis solicitudes (pendientes, aprobadas, rechazadas). */
export const getMisPropuestas = async () => lista(await llamar("get", "/entretenimiento/propuestas/"));
/** { espacio, artista, titulo, tipo, descripcion, necesidades, inicio, fin, personas, acceso } → le llega al admin. */
export const enviarPropuesta = (datos) => llamar("post", "/entretenimiento/propuestas/", datos);
export const retirarPropuesta = (id) => llamar("post", `/entretenimiento/propuestas/${id}/cancelar/`);

// Cupos de eventos: cada reserva trae su QR (`paseo360://evento/<codigo>`).
export const getMisEntradas = async () => lista(await llamar("get", "/entretenimiento/entradas/"));
export const reservarCupo = (evento, cantidad = 1) => llamar("post", "/entretenimiento/entradas/", { evento, cantidad });
export const cancelarCupo = (id) => llamar("post", `/entretenimiento/entradas/${id}/cancelar/`);

// Portería: valida la entrada del QR `paseo360://evento/<codigo>` y registra el ingreso.
export const registrarIngresoEvento = (codigo) =>
  llamar("post", `/porteria/entradas-evento/${encodeURIComponent(codigo)}/`);
