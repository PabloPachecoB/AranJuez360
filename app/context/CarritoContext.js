import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert } from "react-native";

// Regla del documento base del equipo: un pedido pertenece a un solo
// negocio. Si el carrito tiene productos de otro negocio, se vacía antes
// de agregar el nuevo (se le avisa al cliente, no se hace en silencio).
const CarritoContext = createContext(null);

export function CarritoProvider({ children }) {
  const [empresaId, setEmpresaId] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState(null);
  const [items, setItems] = useState([]); // [{producto_id, nombre, precio, cantidad}]

  const vaciar = useCallback(() => {
    setEmpresaId(null);
    setEmpresaNombre(null);
    setItems([]);
  }, []);

  const agregar = useCallback(
    (negocio, producto) => {
      const cambiaDeNegocio = empresaId && empresaId !== negocio.id;
      if (cambiaDeNegocio) {
        Alert.alert(
          "Tu carrito es de otro negocio",
          `Ya tienes productos de ${empresaNombre}. Para agregar algo de ${negocio.nombre} hay que vaciar el carrito actual (un pedido es de un solo negocio).`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Vaciar y agregar",
              style: "destructive",
              onPress: () => {
                setEmpresaId(negocio.id);
                setEmpresaNombre(negocio.nombre);
                setItems([{ producto_id: producto.id, nombre: producto.nombre, precio: Number(producto.precio_promocion ?? producto.precio), cantidad: 1 }]);
              },
            },
          ]
        );
        return;
      }
      setEmpresaId(negocio.id);
      setEmpresaNombre(negocio.nombre);
      setItems((prev) => {
        const existente = prev.find((it) => it.producto_id === producto.id);
        if (existente) {
          return prev.map((it) =>
            it.producto_id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it
          );
        }
        const precio = Number(producto.en_promocion && producto.precio_promocion ? producto.precio_promocion : producto.precio);
        return [...prev, { producto_id: producto.id, nombre: producto.nombre, precio, cantidad: 1 }];
      });
    },
    [empresaId, empresaNombre]
  );

  const cambiarCantidad = useCallback((productoId, cantidad) => {
    if (cantidad <= 0) {
      setItems((prev) => prev.filter((it) => it.producto_id !== productoId));
      return;
    }
    setItems((prev) => prev.map((it) => (it.producto_id === productoId ? { ...it, cantidad } : it)));
  }, []);

  const total = useMemo(() => items.reduce((suma, it) => suma + it.precio * it.cantidad, 0), [items]);
  const cantidadTotal = useMemo(() => items.reduce((suma, it) => suma + it.cantidad, 0), [items]);

  const value = useMemo(
    () => ({ empresaId, empresaNombre, items, agregar, cambiarCantidad, vaciar, total, cantidadTotal }),
    [empresaId, empresaNombre, items, agregar, cambiarCantidad, vaciar, total, cantidadTotal]
  );

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export const useCarrito = () => useContext(CarritoContext);
