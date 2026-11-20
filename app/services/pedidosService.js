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
 * PaseoYa: catálogo de productos de los negocios (con logo y piso del local).
 * filtros: { rubro: "comida", empresa, buscar }
 */
export async function getProductos(filtros = {}) {
  const params = new URLSearchParams({ page_size: "300" });
  Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
  return lista(await llamar("get", `/productos/?${params}`));
}

/**
 * Un pedido = un solo negocio. items: [{ producto_id, cantidad }].
 * retiroProgramado: ISO de la hora reservada para retirar (null = lo antes posible).
 * totalEsperado: el total del carrito; si el negocio cambió un precio, el backend rechaza el pedido.
 */
export const crearPedido = (empresa, items, retiroProgramado = null, totalEsperado = null) =>
  llamar("post", "/pedidos/", { empresa, items, retiro_programado: retiroProgramado, total_esperado: totalEsperado });
export const getMisPedidos = async () => lista(await llamar("get", "/pedidos/"));
export const getPedido = (id) => llamar("get", `/pedidos/${id}/`);
/** Demo: paga el QR desde la app, como si el banco confirmara el cobro. */
export const simularPago = (id) => llamar("post", `/pedidos/${id}/simular-pago/`);
/** Solo mientras no está pagado. */
export const cancelarPedido = (id) => llamar("post", `/pedidos/${id}/cancelar/`);
/** "Ya estoy en el Paseo" cuando el pedido está listo para recoger. */
export const avisarLlegada = (id) => llamar("post", `/pedidos/${id}/llegue/`);
