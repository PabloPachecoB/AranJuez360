import { api } from "./client";

export interface CategoriaApi {
  id: number;
  nombre: string;
}

export function listarCategorias() {
  return api<CategoriaApi[]>("/categorias/", { auth: false });
}
