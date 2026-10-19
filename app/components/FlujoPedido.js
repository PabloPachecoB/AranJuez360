import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { useCarrito } from "../context/CarritoContext";
import { crearPedido, getProductos } from "../services/pedidosService";
import { AvisoOtroLocal, bs, CarritoSheet } from "./CarritoSheet";
import { PagoQRModal } from "./PedidoComer";

/** El precio que se cobra: el de promoción si el producto está en promoción (igual que el backend). */
export const precioVigente = (p) => (p.en_promocion && p.precio_promocion ? p.precio_promocion : p.precio);

/**
 * Flujo de compra de PaseoYa reutilizable (Comer y ficha del restaurante):
 * barra del carrito → carrito (ahora o reservar hora de retiro) → pago con QR.
 * Devuelve `cambiar(producto, ±1)` y los `elementos` que la pantalla debe renderizar.
 */
export function useFlujoPedido({ onPagoCerrado, mostrarBarra = true } = {}) {
  const carrito = useCarrito();
  const [verCarrito, setVerCarrito] = useState(false);
  const [conflicto, setConflicto] = useState(null); // { actual, nuevo } al agregar de otro local
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pago, setPago] = useState(null); // pedido esperando el pago con QR

  const cambiar = (producto, delta) => {
    const conPrecio = { ...producto, precio: precioVigente(producto) };
    const otro = carrito.cambiar(conPrecio, delta);
    if (otro) setConflicto({ actual: otro.empresa_nombre, nuevo: conPrecio });
  };

  const confirmar = async (retiroProgramado) => {
    const local = carrito.local;
    setEnviando(true);
    setError(null);
    try {
      const pedido = await crearPedido(
        local.empresa,
        carrito.lista.map(({ producto, cantidad }) => ({ producto_id: producto.id, cantidad })),
        retiroProgramado,
        Number(carrito.total).toFixed(2),
      );
      carrito.vaciar();
      setVerCarrito(false);
      setPago(pedido);
    } catch (err) {
      setError(err.message);
      // El negocio cambió un precio: el carrito pasa a los precios actuales para que el cliente vea el total real.
      if (/precio cambió/i.test(err.message || "")) {
        try {
          const vigentes = await getProductos({ empresa: local.empresa });
          carrito.actualizarPrecios(vigentes.map((p) => ({ ...p, precio: precioVigente(p) })));
        } catch {
          // Si no se pudo recargar, el mensaje ya pide revisar el pedido.
        }
      }
    } finally {
      setEnviando(false);
    }
  };

  const elementos = (
    <>
      {mostrarBarra && carrito.unidades ? (
        <TouchableOpacity style={styles.barra} activeOpacity={0.9} onPress={() => { setError(null); setVerCarrito(true); }}
          accessibilityLabel="Ver carrito">
          <View style={styles.bolsa}>
            <Ionicons name="bag-handle" size={22} color={STITCH.primary} />
            <Text style={styles.bolsaNumero}>{carrito.unidades}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.barraTitulo}>{bs(carrito.total)}</Text>
            <Text style={styles.barraSub} numberOfLines={1}>{carrito.local?.empresa_nombre} · retiro en el local</Text>
          </View>
          <View style={styles.boton}>
            <Text style={styles.botonTexto}>Ver carrito</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <CarritoSheet visible={verCarrito} onCerrar={() => setVerCarrito(false)} onConfirmar={confirmar}
        enviando={enviando} error={error} />
      <AvisoOtroLocal conflicto={conflicto} onCancelar={() => setConflicto(null)}
        onVaciar={() => { carrito.empezarCon(conflicto.nuevo); setConflicto(null); }} />
      {pago ? (
        <PagoQRModal pedido={pago} onPagado={() => onPagoCerrado?.(false)}
          onCerrar={() => { setPago(null); onPagoCerrado?.(true); }} />
      ) : null}
    </>
  );

  // `pagar(pedido)` reabre el QR de un pedido que quedó sin pagar.
  return { cambiar, pagar: setPago, cantidadDe: carrito.cantidadDe, unidades: carrito.unidades, elementos };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barra: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: STITCH.primary, borderRadius: 18, padding: 14, ...SOMBRA },
  bolsa: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.oro, alignItems: "center", justifyContent: "center" },
  bolsaNumero: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, overflow: "hidden",
    backgroundColor: STITCH.white, color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 12, textAlign: "center",
    lineHeight: 20, paddingHorizontal: 4 },
  barraTitulo: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
  barraSub: { color: "rgba(255,255,255,0.8)", fontFamily: FUENTES.texto, fontSize: 12 },
  boton: { backgroundColor: STITCH.oro, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: "center" },
  botonTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
});
