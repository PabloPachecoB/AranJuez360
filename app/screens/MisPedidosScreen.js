import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { listarMisPedidos } from "../services/pedidosService";

const ETIQUETA_ESTADO = {
  RECIBIDO: "Recibido",
  CONFIRMADO: "Confirmado",
  PREPARANDO: "Preparando",
  LISTO_PARA_RECOGER: "Listo para recoger",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export default function MisPedidosScreen({ navigation }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await listarMisPedidos());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", cargar);
    return unsub;
  }, [navigation, cargar]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Mis pedidos</Text>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}
          ListEmptyComponent={
            <Text style={styles.vacio}>Todavía no hiciste ningún pedido en PaseoYa.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pedido}
              onPress={() => navigation.navigate("PedidoDetalle", { pedidoId: item.id, pedidoInicial: item })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.codigo}>{item.codigo_retiro}</Text>
                <Text style={styles.empresa}>{item.empresa_nombre}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.total}>Bs {item.total}</Text>
                <Text style={styles.estado}>{ETIQUETA_ESTADO[item.estado] || item.estado}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  titulo: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  lista: { padding: 20, gap: 10 },
  vacio: { color: COLORS.muted, textAlign: "center", marginTop: 32 },
  pedido: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
  },
  codigo: { fontWeight: "800", color: COLORS.primary, fontSize: 15, letterSpacing: 1 },
  empresa: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  total: { fontWeight: "700", color: COLORS.text },
  estado: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
});
