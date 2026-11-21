import { api } from "../../api/client";

export interface CajeroApi {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
}

export interface CajeroInput {
  first_name: string;
  last_name: string;
  email: string;
}

export function listarCajeros() {
  return api<{ results: CajeroApi[] }>("/mi-empresa/cajeros/").then((r) => r.results);
}

export function crearCajero(datos: CajeroInput) {
  return api<CajeroApi>("/mi-empresa/cajeros/", { method: "POST", body: datos });
}

export function alternarCajeroActivo(id: number, is_active: boolean) {
  return api<CajeroApi>(`/mi-empresa/cajeros/${id}/`, { method: "PATCH", body: { is_active } });
}
