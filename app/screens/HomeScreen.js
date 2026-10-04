import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";

export default function HomeScreen({ navigation }) {
  const { user, cerrarSesion, recargarPerfil } = useUserContext();
  const [refrescando, setRefrescando] = useState(false);
  const nombre = user?.first_name || user?.username || "cliente";

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await recargarPerfil();
    setRefrescando(false);
  }, [recargarPerfil]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <Text style={styles.hello}>Hola, {nombre}</Text>

        {/* Saldo real desde /auth/yo/ (desliza hacia abajo para actualizar) */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tus Paseo Points</Text>
          <Text style={styles.points}>{user?.puntos_saldo ?? 0}</Text>
          <Text style={styles.cardHint}>
            Muestra tu QR en portería y escanea el QR de los negocios para sumar.
          </Text>
        </View>

        <TouchableOpacity style={styles.paseoYaCard} onPress={() => navigation.navigate("Directorio")}>
          <View style={styles.paseoYaIcono}>
            <Ionicons name="storefront" size={22} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paseoYaTitulo}>Explorar PaseoYa</Text>
            <Text style={styles.paseoYaSub}>Compra en el Paseo, recoge en persona</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.pedidosCard} onPress={() => navigation.navigate("MisPedidos")}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.text} />
          <Text style={styles.pedidosTexto}>Mis pedidos</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>

        <Text style={styles.todo}>
          Pantallas por construir: Mi QR, Escanear negocio, Historial de
          movimientos, Asistente.
        </Text>

        <TouchableOpacity style={styles.logout} onPress={cerrarSesion}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, padding: 24 },
  hello: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 20 },
  card: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  cardLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  points: { color: COLORS.white, fontSize: 48, fontWeight: "800", marginVertical: 8 },
  cardHint: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  paseoYaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  paseoYaIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  paseoYaTitulo: { fontWeight: "700", color: COLORS.text, fontSize: 15 },
  paseoYaSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  pedidosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  pedidosTexto: { fontWeight: "600", color: COLORS.text, fontSize: 14 },
  todo: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  logout: {
    marginTop: "auto",
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: COLORS.danger, fontWeight: "700" },
});
