export interface Negocio {
  id: string;
  nombre: string;
  categoria_id: string;
  descripcion: string;
  piso: string;
  local: string;
  referencia: string;
  horario: string;
  logo_url: string;
  activo: boolean;
}

export interface Producto {
  id: string;
  negocio_id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  foto_url: string;
  stock: number;
  en_promocion: boolean;
  precio_promocion: number | null;
  activo: boolean;
  creado_en: string;
}

export type ProductoInput = Omit<Producto, "id" | "negocio_id" | "creado_en">;

export type EstadoPedido =
  | "recibido"
  | "confirmado"
  | "preparando"
  | "listo_para_recoger"
  | "cliente_llego"
  | "entregado"
  | "cancelado";

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  negocio_id: string;
  total: number;
  estado: EstadoPedido;
  codigo_retiro: string;
  cupon_id: string | null;
  entregado_en: string | null;
  creado_en: string;
}
