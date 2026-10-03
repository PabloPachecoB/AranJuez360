// Capa de datos TEMPORAL en localStorage, con la forma del contrato de docs/BASE_PROYECTO_PASEO.md.
// Cuando el backend exista, reemplazar el cuerpo de estas funciones por fetch a:
//   GET/PUT /negocios/:id · GET/POST /productos · PUT/DELETE /productos/:id
import { useSyncExternalStore } from 'react';
import type { Categoria, Combo, Negocio, Producto } from '../types';

export const CATEGORIAS: Categoria[] = [
  { id: 'cat-comida', nombre: 'Comida' },
  { id: 'cat-tec', nombre: 'Tecnología' },
  { id: 'cat-moda', nombre: 'Moda' },
];

type State = { negocio: Negocio; productos: Producto[]; combos: Combo[]; secciones: string[] };

const KEY = 'paseoya_web_v1';
const uid = () => Math.random().toString(36).slice(2, 10);

const seed = (): State => ({
  negocio: {
    id: 'neg-demo',
    nombre: 'Mi Negocio',
    categoria_id: 'cat-comida',
    descripcion: '',
    piso: '1',
    local: '',
    referencia: '',
    horario: 'Lun a Sáb 10:00 a 21:00',
    logo_url: '',
    activo: true,
    fotos_local: [],
    facebook: '',
    instagram: '',
    whatsapp: '',
  },
  productos: [],
  combos: [],
  secciones: [],
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    /* ignorar */
  }
  return seed();
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    alert('No hay espacio para guardar tantas fotos. Usa imágenes más pequeñas o elimina algunas.');
  }
  listeners.forEach((l) => l());
}

export const useDb = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );

export const api = {
  saveNegocio(n: Negocio) {
    commit({ ...state, negocio: n });
  },
  saveProducto(p: Omit<Producto, 'id' | 'negocio_id'> & { id?: string }) {
    const full: Producto = { ...p, id: p.id ?? uid(), negocio_id: state.negocio.id };
    const exists = state.productos.some((x) => x.id === full.id);
    commit({
      ...state,
      productos: exists ? state.productos.map((x) => (x.id === full.id ? full : x)) : [full, ...state.productos],
    });
  },
  deleteProducto(id: string) {
    commit({ ...state, productos: state.productos.filter((x) => x.id !== id) });
  },
  addSeccion(nombre: string) {
    const n = nombre.trim();
    if (!n || state.secciones.some((s) => s.toLowerCase() === n.toLowerCase())) return;
    commit({ ...state, secciones: [...state.secciones, n] });
  },
  saveCombo(c: Omit<Combo, 'id' | 'negocio_id'> & { id?: string }) {
    const full: Combo = { ...c, id: c.id ?? uid(), negocio_id: state.negocio.id };
    const exists = state.combos.some((x) => x.id === full.id);
    commit({ ...state, combos: exists ? state.combos.map((x) => (x.id === full.id ? full : x)) : [full, ...state.combos] });
  },
  deleteCombo(id: string) {
    commit({ ...state, combos: state.combos.filter((x) => x.id !== id) });
  },
  setPromocion(id: string, precio_promocion: number | null) {
    commit({
      ...state,
      productos: state.productos.map((x) =>
        x.id === id ? { ...x, en_promocion: precio_promocion != null, precio_promocion } : x,
      ),
    });
  },
};
