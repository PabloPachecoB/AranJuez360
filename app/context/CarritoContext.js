import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUserContext } from "./UserContext";

// Carrito de Comer: vive mientras la app está abierta (no se pierde al cambiar de pantalla).
// Regla del backend: un pedido = un solo local.
const CarritoContext = createContext(null);

export function CarritoProvider({ children }) {
  const { user } = useUserContext();
  const [items, setItems] = useState({}); // { productoId: { producto, cantidad } }

  // Otra cuenta en el mismo teléfono empieza con el carrito vacío.
  useEffect(() => setItems({}), [user?.id]);

  const lista = useMemo(() => Object.values(items), [items]);
  const unidades = lista.reduce((suma, it) => suma + it.cantidad, 0);
  const total = lista.reduce((suma, it) => suma + Number(it.producto.precio) * it.cantidad, 0);
  const local = lista[0]?.producto ?? null; // datos del local (empresa, nombre, logo, piso)

  /** Suma o resta. Devuelve el producto del otro local si hay conflicto (no agrega nada). */
  const cambiar = useCallback((producto, delta) => {
    const otro = lista.find((it) => it.producto.empresa !== producto.empresa);
    if (delta > 0 && otro) return otro.producto;
    setItems((prev) => {
      const cantidad = (prev[producto.id]?.cantidad || 0) + delta;
      const siguiente = { ...prev };
      if (cantidad > 0) siguiente[producto.id] = { producto: prev[producto.id]?.producto || producto, cantidad };
      else delete siguiente[producto.id];
      return siguiente;
    });
    return null;
  }, [lista]);

  const quitar = useCallback((productoId) => setItems((prev) => {
    const siguiente = { ...prev };
    delete siguiente[productoId];
    return siguiente;
  }), []);

  /** Vacía el carrito y empieza con este producto (cuando se cambia de local). */
  const empezarCon = useCallback((producto) => setItems({ [producto.id]: { producto, cantidad: 1 } }), []);
  const vaciar = useCallback(() => setItems({}), []);
  const cantidadDe = useCallback((productoId) => items[productoId]?.cantidad || 0, [items]);

  const valor = useMemo(
    () => ({ lista, unidades, total, local, cambiar, quitar, empezarCon, vaciar, cantidadDe }),
    [lista, unidades, total, local, cambiar, quitar, empezarCon, vaciar, cantidadDe],
  );
  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error("useCarrito debe usarse dentro de CarritoProvider");
  return ctx;
}
