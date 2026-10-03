import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { COLORS } from "../constants/colors";
import { obtenerPedido } from "../services/pedidosService";

const ETIQUETA_ESTADO = {
  RECIBIDO: "Recibido",
  CONFIRMADO: "Confirmado",
  PREPARANDO: "Preparando",
  LISTO_PARA_RECOGER: "Listo para recoger",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const COLOR_ESTADO = {
  RECIBIDO: COLORS.secondary,
  CONFIRMADO: COLORS.secondary,
  PREPARANDO: COLORS.accent,
  LISTO_PARA_RECOGER: COLORS.primary,
  ENTREGADO: "#16A34A",
  CANCELADO: COLORS.danger,
};

export default function PedidoDetalleScreen({ route, navigation }) {
  const { pedidoId, pedidoInicial } = route.params;
  const [pedido, setPedido] = useState(pedidoInicial || null);
  const [cargando, setCargando] = useState(!pedidoInicial);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPedido(await obtenerPedido(pedidoId));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando || !pedido) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const listoParaRetirar = pedido.estado === "LISTO_PARA_RECOGER";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar();
            }}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.titulo}>Pedido {pedido.codigo_retiro}</Text>
        </View>

        <View style={[styles.estadoBadge, { backgroundColor: COLOR_ESTADO[pedido.estado] }]}>
          <Text style={styles.estadoTexto}>{ETIQUETA_ESTADO[pedido.estado] || pedido.estado}</Text>
        </View>

        <Text style={styles.empresa}>{pedido.empresa_nombre}</Text>

        {listoParaRetirar && (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitulo}>Presenta este código al recoger</Text>
            <View style={styles.qrBox}>
              <QRCode value={pedido.codigo_retiro} size={180} />
            </View>
            <Text style={styles.qrCodigo}>{pedido.codigo_retiro}</Text>
          </View>
        )}

        {pedido.estado === "ENTREGADO" && (
          <View style={styles.entregadoCard}>
            <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
            <Text style={styles.entregadoTexto}>¡Ya recogiste este pedido!</Text>
          </View>
        )}

        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitulo}>Tu pedido</Text>
          {pedido.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemNombre}>
                {item.cantidad}x {item.producto_nombre}
              </Text>
              <Text style={styles.itemPrecio}>Bs {(item.cantidad * Number(item.precio_unitario)).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.total}>Bs {pedido.total}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  titulo: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  estadoBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  estadoTexto: { color: COLORS.white, fontWeight: "700", fontSize: 12 },
  empresa: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 8 },
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginTop: 16,
    gap: 10,
  },
  qrTitulo: { fontWeight: "700", color: COLORS.text, fontSize: 14, textAlign: "center" },
  qrBox: { padding: 12, backgroundColor: COLORS.white, borderRadius: 12 },
  qrCodigo: { fontSize: 20, fontWeight: "800", letterSpacing: 2, color: COLORS.primary },
  entregadoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#DCFCE7",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  entregadoTexto: { color: "#166534", fontWeight: "700" },
  itemsCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginTop: 16 },
  itemsTitulo: { fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  itemNombre: { color: COLORS.text, fontSize: 13, flex: 1 },
  itemPrecio: { color: COLORS.muted, fontSize: 13 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  totalLabel: { fontWeight: "700", color: COLORS.text },
  total: { fontWeight: "800", color: COLORS.primary, fontSize: 16 },
});
