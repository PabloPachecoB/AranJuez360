import { api, apiForm } from "./client";

export interface ProductoApi {
  id: number;
  nombre: string;
  descripcion: string;
  precio: string; // DRF serializa DecimalField como string
  foto: string | null;
  stock: number;
  en_promocion: boolean;
  precio_promocion: string | null;
  activo: boolean;
  creado_en: string;
}

export type ProductoInput = {
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  en_promocion: boolean;
  precio_promocion: number | null;
  activo: boolean;
};

interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function listarMisProductos(): Promise<ProductoApi[]> {
  const data = await api<Paginado<ProductoApi>>("/mi-empresa/productos/");
  return data.results;
}

function aFormData(datos: Record<string, unknown>, foto: File): FormData {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === null || valor === undefined) continue;
    fd.append(clave, String(valor));
  }
  fd.append("foto", foto);
  return fd;
}

export function crearProducto(datos: ProductoInput, foto?: File | null) {
  if (foto) {
    return apiForm<ProductoApi>("/mi-empresa/productos/", aFormData(datos, foto), "POST");
  }
  return api<ProductoApi>("/mi-empresa/productos/", { method: "POST", body: datos });
}

export function actualizarProducto(id: number, datos: Partial<ProductoInput>, foto?: File | null) {
  if (foto) {
    return apiForm<ProductoApi>(`/mi-empresa/productos/${id}/`, aFormData(datos, foto), "PATCH");
  }
  return api<ProductoApi>(`/mi-empresa/productos/${id}/`, { method: "PATCH", body: datos });
}

export function eliminarProducto(id: number) {
  return api<void>(`/mi-empresa/productos/${id}/`, { method: "DELETE" });
}
