// Comercios de EJEMPLO de otros compañeros, solo para la vista "Ver presentación".
// Se reemplaza por GET /negocios y GET /productos?negocio_id= cuando exista el backend.
import type { Combo, Negocio, Producto } from '../types';

function art(c1: string, c2: string, texto: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><text x="50%" y="54%" font-size="64" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">${texto}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const neg = (id: string, nombre: string, categoria_id: string, piso: string, local: string, c1: string, c2: string, descripcion: string, horario = 'Lun a Sáb 10:00 a 21:00'): Negocio => ({
  id,
  nombre,
  categoria_id,
  descripcion,
  piso,
  local,
  referencia: '',
  horario,
  logo_url: art(c1, c2, nombre[0]),
  activo: true,
  fotos_local: [art(c1, c2, nombre)],
  facebook: '',
  instagram: '',
  whatsapp: '70000000',
});

const prod = (negocio_id: string, i: number, nombre: string, precio: number, c1: string, c2: string, promo?: number): Producto => ({
  id: `${negocio_id}-${i}`,
  negocio_id,
  nombre,
  descripcion: '',
  seccion: 'General',
  precio,
  foto_url: art(c1, c2, nombre.split(' ')[0]),
  stock: 10,
  en_promocion: promo != null,
  precio_promocion: promo ?? null,
  activo: true,
});

export type Entrada = { negocio: Negocio; productos: Producto[]; combos: Combo[]; mio?: boolean };

const combo = (negocio_id: string, i: number, nombre: string, precio: number, items: [number, number][], c1: string, c2: string): Combo => ({
  id: `${negocio_id}-c${i}`,
  negocio_id,
  nombre,
  descripcion: '',
  precio,
  foto_url: art(c1, c2, 'COMBO'),
  items: items.map(([n, cantidad]) => ({ producto_id: `${negocio_id}-${n}`, cantidad })),
  activo: true,
});

const COMBOS: Combo[] = [
  combo('d1', 1, 'Combo Pizza + Lunch', 70, [[1, 1], [3, 1]], '#ea580c', '#7c2d12'),
  combo('d2', 1, 'Combo Burger Doble + Papas', 52, [[2, 1], [3, 1]], '#a16207', '#451a03'),
  combo('d3', 1, 'Pack Audio + Cargador', 290, [[1, 1], [2, 1]], '#0284c7', '#082f49'),
  combo('d4', 1, 'Look Casual', 380, [[1, 1], [2, 1]], '#db2777', '#4a044e'),
];

const BASE: Omit<Entrada, 'combos'>[] = [
  {
    negocio: neg('d1', 'Almacén de Pizzas', 'cat-comida', '3', '5', '#c2410c', '#7c2d12', 'Pizzas artesanales al horno de piedra.', 'Lun a Dom 11:00 a 22:00'),
    productos: [
      prod('d1', 1, 'Pizza Pepperoni personal', 55, '#dc2626', '#991b1b', 45),
      prod('d1', 2, 'Pizza Margarita', 48, '#f97316', '#c2410c'),
      prod('d1', 3, 'Lunch time combo', 30, '#ea580c', '#9a3412', 25),
    ],
  },
  {
    negocio: neg('d2', 'Bypass Burger', 'cat-comida', '3', '7', '#b91c1c', '#450a0a', 'Hamburguesas de carne 100% res.'),
    productos: [
      prod('d2', 1, 'Burger Clásica', 35, '#b45309', '#78350f'),
      prod('d2', 2, 'Burger Doble queso', 48, '#a16207', '#713f12', 40),
      prod('d2', 3, 'Papas rústicas', 18, '#ca8a04', '#854d0e'),
    ],
  },
  {
    negocio: neg('d3', 'Voltio Store', 'cat-tec', '2', '21', '#0369a1', '#082f49', 'Audio, cargadores y accesorios.'),
    productos: [
      prod('d3', 1, 'Audífonos Bluetooth', 280, '#0284c7', '#075985', 240),
      prod('d3', 2, 'Cargador rápido 20W', 65, '#0ea5e9', '#0369a1'),
    ],
  },
  {
    negocio: neg('d4', 'Hilo & Aguja', 'cat-moda', '1', '12', '#be185d', '#500724', 'Ropa casual para toda la familia.', 'Lun a Sáb 10:00 a 20:00'),
    productos: [
      prod('d4', 1, 'Camisa de lino', 189, '#db2777', '#9d174d'),
      prod('d4', 2, 'Jean clásico', 249, '#4f46e5', '#312e81', 199),
      prod('d4', 3, 'Polera estampada', 120, '#c026d3', '#701a75'),
    ],
  },
];

const SECCIONES: Record<string, string> = {
  'd1-1': 'Pizzas', 'd1-2': 'Pizzas', 'd1-3': 'Combos de almuerzo',
  'd2-1': 'Hamburguesas', 'd2-2': 'Hamburguesas', 'd2-3': 'Acompañamientos',
  'd3-1': 'Audio', 'd3-2': 'Accesorios',
  'd4-1': 'Camisas', 'd4-2': 'Pantalones', 'd4-3': 'Poleras',
};

export const DEMO: Entrada[] = BASE.map((b) => ({ ...b, productos: b.productos.map((p) => ({ ...p, seccion: SECCIONES[p.id] ?? 'General' })), combos: COMBOS.filter((c) => c.negocio_id === b.negocio.id) }));
