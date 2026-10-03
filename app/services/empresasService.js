import { api, ApiError } from "./apiClient";

export async function listarCategorias() {
  try {
    const { data } = await api.get("/categorias/");
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

export async function listarEmpresas({ categoria, buscar } = {}) {
  try {
    const { data } = await api.get("/empresas/", { params: { categoria, buscar } });
    return data.results;
  } catch (err) {
    throw new ApiError(err);
  }
}

export async function obtenerEmpresa(id) {
  try {
    const { data } = await api.get(`/empresas/${id}/`);
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

/** Buscador global de PaseoYa: productos de cualquier negocio que coincidan. */
export async function buscarProductos(texto) {
  try {
    const { data } = await api.get("/productos/", { params: { buscar: texto } });
    return data.results;
  } catch (err) {
    throw new ApiError(err);
  }
}
