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

export interface VarianteOpcion {
  id: string;
  nombre: string;
  precio_extra: number;
}

// Nota: "variantes" no existe todavía en el schema acordado por el equipo
// (ver docs/BASE_PROYECTO_PASEO.md, tabla productos). Es una propuesta de UI,
// client-side por ahora — no persiste a ningún backend real. Falta validarla
// con el equipo antes de tratarla como campo definitivo.
export interface ProductoVariantes {
  tamanios: VarianteOpcion[];
  extras: VarianteOpcion[];
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
  variantes?: ProductoVariantes;
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
