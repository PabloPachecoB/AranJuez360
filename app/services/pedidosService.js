import { api, ApiError } from "./apiClient";

/** items: [{ producto_id, cantidad }], todos del mismo negocio. */
export async function crearPedido(empresaId, items) {
  try {
    const { data } = await api.post("/pedidos/", { empresa: empresaId, items });
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

export async function listarMisPedidos() {
  try {
    const { data } = await api.get("/pedidos/");
    return data.results;
  } catch (err) {
    throw new ApiError(err);
  }
}

export async function obtenerPedido(id) {
  try {
    const { data } = await api.get(`/pedidos/${id}/`);
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}
