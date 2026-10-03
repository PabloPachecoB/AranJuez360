import { api, ApiError } from "./apiClient";

/** { cartelera: [película + funciones], eventos, destacado, actividades } */
export async function getDiversion() {
  try {
    const { data } = await api.get("/entretenimiento/");
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}
