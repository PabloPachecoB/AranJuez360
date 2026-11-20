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

/**
 * Directorio de negocios y emprendimientos (datos que cada empresa carga en su panel).
 * filtros: { tipo: "NEGOCIO,EMPRENDIMIENTO", rubro, excluir_rubro, piso, buscar, categoria }
 */
export async function getEmpresas(filtros = {}) {
  const params = new URLSearchParams({ page_size: "200" });
  Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
  return lista(await llamar("get", `/empresas/?${params}`));
}
export const getEmpresa = (id) => llamar("get", `/empresas/${id}/`);
export const getCategorias = async () => lista(await llamar("get", "/categorias/"));

// Beneficios del cliente: catálogo, canje, cupones y entradas de cine.
export const getRecompensas = async () => lista(await llamar("get", "/puntos/recompensas/?page_size=200"));
export const canjearRecompensa = (id) => llamar("post", `/puntos/recompensas/${id}/canjear/`);
export const getMisCupones = async () => lista(await llamar("get", "/puntos/canjes/"));
export const getMisReservas = async () => lista(await llamar("get", "/entretenimiento/reservas/"));
export const cancelarReserva = (id) => llamar("post", `/entretenimiento/reservas/${id}/cancelar/`);
