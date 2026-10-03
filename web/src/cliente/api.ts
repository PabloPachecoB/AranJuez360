import { api } from "../api/client";

export interface Monedero {
  saldo: string;
  saldo_bs: string;
  valor_moneda_bs: string;
  recompensas_disponibles: number;
  puntos_por_boliviano: string;
  puntos_por_visita: string;
  siguiente: null | {
    id: number;
    nombre: string;
    costo_puntos: string;
    empresa: string | null;
    faltan_puntos: string;
    faltan_bs: number | null;
    progreso: number;
  };
}

export interface PaseQr {
  token: string;
  vigencia_segundos: number;
}

export interface Recompensa {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: string;
  costo_puntos: string;
  empresa: number | null;
  empresa_nombre: string | null;
  imagen: string | null;
  activo: boolean;
}

export interface Cupon {
  id: number;
  recompensa: number;
  recompensa_nombre: string;
  categoria: string;
  empresa_nombre: string | null;
  monedas: string;
  codigo: string;
  estado: "ACTIVO" | "USADO" | "ANULADO";
  estado_nombre: string;
  creado_en: string;
  usado_en: string | null;
}

export interface Movimiento {
  id: number;
  empresa: number | null;
  empresa_nombre: string | null;
  puntos: string;
  tipo: "COMPRA" | "VISITA" | "ACTIVIDAD" | "CANJE";
  descripcion: string;
  creado_en: string;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  tipo: string;
  categoria: number | null;
  categoria_nombre: string | null;
  piso: string;
  local: string;
  logo: string | null;
}

export interface Oferta {
  id: number;
  titulo: string;
  descripcion: string;
  precio_oferta: string | null;
  precio_normal: string | null;
  imagen: string | null;
  fin: string;
  empresa_id: number;
  empresa_nombre: string;
  piso: string;
  local: string;
}

export type ListaApi<T> = T[] | { results: T[] };

function items<T>(response: ListaApi<T>): T[] {
  return Array.isArray(response) ? response : response.results;
}

export async function obtenerMonedero() {
  return api<Monedero>("/puntos/monedero/");
}

export async function obtenerPaseQr() {
  return api<PaseQr>("/puntos/mi-qr/");
}

export async function listarRecompensas() {
  return items(await api<ListaApi<Recompensa>>("/puntos/recompensas/"));
}

export function canjearRecompensa(id: number) {
  return api<Cupon>(`/puntos/recompensas/${id}/canjear/`, { method: "POST", body: {} });
}

export async function listarCupones() {
  return items(await api<ListaApi<Cupon>>("/puntos/canjes/"));
}

export async function listarMovimientos() {
  return items(await api<ListaApi<Movimiento>>("/puntos/movimientos/"));
}

export async function listarCategorias() {
  return items(await api<ListaApi<Categoria>>("/categorias/", { auth: false }));
}

export async function listarEmpresas(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return items(await api<ListaApi<Empresa>>(`/empresas/${suffix}`, { auth: false }));
}

export async function listarOfertas() {
  return items(await api<ListaApi<Oferta>>("/ofertas/", { auth: false }));
}