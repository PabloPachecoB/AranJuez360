import type { Negocio, Pedido, PedidoItem, Producto } from "./types";

// Datos inventados para desarrollo — reemplazar cuando el backend real
// (stack "por definir" por el equipo, ver docs/BASE_PROYECTO_PASEO.md) esté listo.

export const negocioActual: Negocio = {
  id: "negocio-1",
  nombre: "Café Aromas",
  categoria_id: "categoria-comida",
  descripcion: "Cafetería y repostería en Paseo Aranjuez",
  piso: "1",
  local: "12",
  referencia: "Frente a la plazuela central",
  horario: "Lun a Sáb 09:00 a 20:00",
  logo_url: "",
  activo: true,
};

export const productosIniciales: Producto[] = [
  {
    id: "producto-1",
    negocio_id: "negocio-1",
    nombre: "Café Americano",
    descripcion: "Café de grano recién molido, 300ml",
    precio: 15,
    foto_url: "",
    stock: 40,
    en_promocion: false,
    precio_promocion: null,
    activo: true,
    creado_en: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "producto-2",
    negocio_id: "negocio-1",
    nombre: "Chocolate Caliente",
    descripcion: "Chocolate con leche, tamaño grande",
    precio: 18,
    foto_url: "",
    stock: 3,
    en_promocion: false,
    precio_promocion: null,
    activo: true,
    creado_en: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "producto-3",
    negocio_id: "negocio-1",
    nombre: "Sandwich de Pollo",
    descripcion: "Pan ciabatta, pollo, lechuga y tomate",
    precio: 25,
    foto_url: "",
    stock: 12,
    en_promocion: true,
    precio_promocion: 20,
    activo: true,
    creado_en: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "producto-4",
    negocio_id: "negocio-1",
    nombre: "Jugo Natural de Naranja",
    descripcion: "500ml, exprimido al momento",
    precio: 12,
    foto_url: "",
    stock: 20,
    en_promocion: false,
    precio_promocion: null,
    activo: true,
    creado_en: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "producto-5",
    negocio_id: "negocio-1",
    nombre: "Torta de Chocolate (porción)",
    descripcion: "Porción individual, 120g",
    precio: 14,
    foto_url: "",
    stock: 0,
    en_promocion: false,
    precio_promocion: null,
    activo: false,
    creado_en: "2026-10-01T10:00:00.000Z",
  },
];

export const STOCK_BAJO_UMBRAL = 5;

// Subconjunto de "usuarios" (rol cliente), solo para mostrar el nombre en el panel.
export const clientesMock: Record<string, { nombre: string }> = {
  "cliente-1": { nombre: "Marcelo Quispe" },
  "cliente-2": { nombre: "Daniela Rojas" },
  "cliente-3": { nombre: "Jorge Fernández" },
};

export const pedidoItemsIniciales: PedidoItem[] = [
  { id: "item-1", pedido_id: "pedido-1", producto_id: "producto-3", cantidad: 2, precio_unitario: 20 },
  { id: "item-2", pedido_id: "pedido-2", producto_id: "producto-1", cantidad: 1, precio_unitario: 15 },
  { id: "item-3", pedido_id: "pedido-2", producto_id: "producto-4", cantidad: 1, precio_unitario: 12 },
  { id: "item-4", pedido_id: "pedido-3", producto_id: "producto-2", cantidad: 2, precio_unitario: 18 },
  { id: "item-5", pedido_id: "pedido-4", producto_id: "producto-1", cantidad: 3, precio_unitario: 15 },
];

export const pedidosIniciales: Pedido[] = [
  {
    id: "pedido-1",
    cliente_id: "cliente-1",
    negocio_id: "negocio-1",
    total: 40,
    estado: "recibido",
    codigo_retiro: "PY-4821",
    cupon_id: null,
    entregado_en: null,
    creado_en: "2026-10-02T14:10:00.000Z",
  },
  {
    id: "pedido-2",
    cliente_id: "cliente-2",
    negocio_id: "negocio-1",
    total: 27,
    estado: "preparando",
    codigo_retiro: "PY-4822",
    cupon_id: null,
    entregado_en: null,
    creado_en: "2026-10-02T14:25:00.000Z",
  },
  {
    id: "pedido-3",
    cliente_id: "cliente-3",
    negocio_id: "negocio-1",
    total: 36,
    estado: "listo_para_recoger",
    codigo_retiro: "PY-4790",
    cupon_id: null,
    entregado_en: null,
    creado_en: "2026-10-02T13:40:00.000Z",
  },
  {
    id: "pedido-4",
    cliente_id: "cliente-1",
    negocio_id: "negocio-1",
    total: 45,
    estado: "entregado",
    codigo_retiro: "PY-4701",
    cupon_id: null,
    entregado_en: "2026-10-02T12:05:00.000Z",
    creado_en: "2026-10-02T11:30:00.000Z",
  },
];
