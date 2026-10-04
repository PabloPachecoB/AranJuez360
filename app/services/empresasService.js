import { api, ApiError } from "./apiClient";

async function get(url, params) {
  try {
    const { data } = await api.get(url, { params });
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

/** Ofertas vigentes hoy: [{ id, titulo, precio_oferta, precio_normal, imagen, empresa_nombre, piso, local, fin }] */
export const getOfertas = () => get("/ofertas/");
