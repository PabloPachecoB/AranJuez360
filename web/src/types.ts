// Nombres según docs/BASE_PROYECTO_PASEO.md sección 4.
// PROPUESTA (pendiente de aprobar por el equipo): fotos_local, facebook, instagram, whatsapp en `negocios`.

export type Categoria = { id: string; nombre: string };

export type Negocio = {
  id: string;
  nombre: string;
  categoria_id: string;
  descripcion: string;
  piso: string;
  local: string;
  referencia: string;
  horario: string; // ej. "Lun a Sáb 10:00 a 21:00"
  logo_url: string;
  activo: boolean;
  // propuestas
  fotos_local: string[];
  facebook: string;
  instagram: string;
  whatsapp: string;
};

// PROPUESTA (pendiente de aprobar por el equipo): tabla `combos` con sus items.
export type ComboItem = { producto_id: string; cantidad: number };

export type Combo = {
  id: string;
  negocio_id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  foto_url: string;
  items: ComboItem[];
  activo: boolean;
};

export type Producto = {
  id: string;
  negocio_id: string;
  nombre: string;
  descripcion: string;
  // PROPUESTA (pendiente de aprobar por el equipo): sección del menú, ej. "Tecitos", "Repostería dulce".
  seccion: string;
  precio: number;
  foto_url: string;
  stock: number;
  en_promocion: boolean;
  precio_promocion: number | null;
  activo: boolean;
};
