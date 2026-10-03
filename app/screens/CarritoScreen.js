import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import PrimaryButton from "../components/PrimaryButton";
import { useCarrito } from "../context/CarritoContext";
import { crearPedido } from "../services/pedidosService";

export default function CarritoScreen({ navigation }) {
  const carrito = useCarrito();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  async function confirmarPedido() {
    if (!carrito?.items.length) return;
    setEnviando(true);
    setError(null);
    try {
      const pedido = await crearPedido(
        carrito.empresaId,
        carrito.items.map((it) => ({ producto_id: it.producto_id, cantidad: it.cantidad }))
      );
      carrito.vaciar();
      navigation.replace("PedidoDetalle", { pedidoId: pedido.id, pedidoInicial: pedido });
    } catch (err) {
      setError(err.message || "No se pudo crear el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  const vacio = !carrito || carrito.items.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Tu carrito</Text>
      </View>

      {vacio ? (
        <View style={styles.vacioWrap}>
          <Ionicons name="cart-outline" size={48} color={COLORS.muted} />
          <Text style={styles.vacioTexto}>Tu carrito está vacío.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.empresaNombre}>{carrito.empresaNombre}</Text>
          <FlatList
            data={carrito.items}
            keyExtractor={(item) => String(item.producto_id)}
            contentContainerStyle={styles.lista}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNombre}>{item.nombre}</Text>
                  <Text style={styles.itemPrecio}>Bs {item.precio} c/u</Text>
                </View>
                <View style={styles.cantidadBox}>
                  <TouchableOpacity
                    style={styles.cantidadBtn}
                    onPress={() => carrito.cambiarCantidad(item.producto_id, item.cantidad - 1)}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.cantidadTexto}>{item.cantidad}</Text>
                  <TouchableOpacity
                    style={styles.cantidadBtn}
                    onPress={() => carrito.cambiarCantidad(item.producto_id, item.cantidad + 1)}
                  >
                    <Ionicons name="add" size={16} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <View style={styles.footer}>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>Bs {carrito.total}</Text>
            </View>
            <Text style={styles.aviso}>
              Pagas aquí y recoges en persona en Paseo Aranjuez — no hay entrega a domicilio.
            </Text>
            <PrimaryButton title="Confirmar pedido" onPress={confirmarPedido} loading={enviando} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  titulo: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  vacioWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  vacioTexto: { color: COLORS.muted },
  empresaNombre: { paddingHorizontal: 20, paddingTop: 12, color: COLORS.muted, fontSize: 13, fontWeight: "600" },
  lista: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
  },
  itemNombre: { fontWeight: "700", color: COLORS.text, fontSize: 14 },
  itemPrecio: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  cantidadBox: { flexDirection: "row", alignItems: "center", gap: 10 },
  cantidadBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cantidadTexto: { fontWeight: "700", color: COLORS.text, minWidth: 18, textAlign: "center" },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 15, color: COLORS.text, fontWeight: "600" },
  total: { fontSize: 20, color: COLORS.primary, fontWeight: "800" },
  aviso: { color: COLORS.muted, fontSize: 11, marginBottom: 10 },
  error: { color: COLORS.danger, fontSize: 12, marginBottom: 8 },
});
