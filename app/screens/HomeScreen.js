import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";

export default function HomeScreen() {
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

        <Text style={styles.todo}>
          Pantallas por construir: Mi QR, Escanear negocio, Historial de
          movimientos, Directorio de empresas, Asistente.
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
  cardLabel: { color: COLORS.secondary, fontSize: 14, fontWeight: "600" },
  points: { color: COLORS.white, fontSize: 48, fontWeight: "800", marginVertical: 8 },
  cardHint: { color: "#CBD5E1", fontSize: 13 },
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
