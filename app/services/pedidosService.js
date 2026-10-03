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

/** Un pedido = un solo negocio. items: [{ producto_id, cantidad }]. Devuelve el pedido con su código de retiro. */
export const crearPedido = (empresa, items) => llamar("post", "/pedidos/", { empresa, items });
export const getMisPedidos = async () => lista(await llamar("get", "/pedidos/"));
