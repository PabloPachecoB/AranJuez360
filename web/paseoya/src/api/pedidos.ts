import { api } from "./client";

export type EstadoPedidoApi =
  | "RECIBIDO"
  | "CONFIRMADO"
  | "PREPARANDO"
  | "LISTO_PARA_RECOGER"
  | "ENTREGADO"
  | "CANCELADO";

export interface PedidoItemApi {
  id: number;
  producto: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: string;
}

export interface PedidoApi {
  id: number;
  cliente: number;
  cliente_nombre: string;
  empresa: number;
  empresa_nombre: string;
  total: string;
  estado: EstadoPedidoApi;
  estado_display: string;
  codigo_retiro: string;
  items: PedidoItemApi[];
  entregado_en: string | null;
  creado_en: string;
}

interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function listarPedidosEmpresa(): Promise<PedidoApi[]> {
  const data = await api<Paginado<PedidoApi>>("/mi-empresa/pedidos/");
  return data.results;
}

export function avanzarPedido(id: number) {
  return api<PedidoApi>(`/mi-empresa/pedidos/${id}/avanzar/`, { method: "POST" });
}

export function cancelarPedido(id: number) {
  return api<PedidoApi>(`/mi-empresa/pedidos/${id}/cancelar/`, { method: "POST" });
}

export function validarRetiro(codigo_retiro: string) {
  return api<PedidoApi>("/mi-empresa/pedidos/validar-retiro/", {
    method: "POST",
    body: { codigo_retiro },
  });
}
