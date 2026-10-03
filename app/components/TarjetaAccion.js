import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/** Propuesta de Jarvis (reservar, canjear, cancelar) que espera la confirmación del usuario. */
export default function TarjetaAccion({ accion, onConfirmar, onCancelar, oscura }) {
  const pendiente = accion.estado === "pendiente";
  const estados = { procesando: "Procesando…", confirmada: "✓ Hecho", cancelada: "Cancelado", fallida: "No se pudo" };
  return (
    <View style={[styles.accion, oscura && styles.accionOscura]}>
      <View style={styles.accionCabecera}>
        <Ionicons name={accion.tipo === "canjear_recompensa" ? "gift" : "ticket"} size={18} color="#B7791F" />
        <Text style={[styles.accionTitulo, oscura && styles.accionTituloOscura]}>¿Confirmas?</Text>
      </View>
      <Text style={[styles.accionResumen, oscura && styles.accionResumenOscura]}>{accion.resumen}</Text>
      {pendiente ? (
        <View style={styles.accionBotones}>
          <TouchableOpacity style={styles.accionCancelar} onPress={() => onCancelar(accion)}>
            <Text style={styles.accionCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accionConfirmar} onPress={() => onConfirmar(accion)}>
            <Text style={styles.accionConfirmarTexto}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.accionEstado}>{estados[accion.estado]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  accion: { marginTop: 10, backgroundColor: "#FFF8E1", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#F5B301" },
  accionOscura: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(245,179,1,0.6)", marginHorizontal: 24 },
  accionCabecera: { flexDirection: "row", alignItems: "center", gap: 6 },
  accionTitulo: { fontSize: 14, fontWeight: "800", color: "#8A5A00" },
  accionTituloOscura: { color: "#F5B301" },
  accionResumen: { fontSize: 14, color: COLORS.text, marginTop: 6, lineHeight: 20 },
  accionResumenOscura: { color: COLORS.white },
  accionBotones: { flexDirection: "row", gap: 8, marginTop: 10 },
  accionCancelar: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: COLORS.muted },
  accionCancelarTexto: { color: COLORS.muted, fontWeight: "700" },
  accionConfirmar: { flex: 1.4, borderRadius: 999, paddingVertical: 10, alignItems: "center", backgroundColor: COLORS.primary },
  accionConfirmarTexto: { color: COLORS.white, fontWeight: "800" },
  accionEstado: { marginTop: 8, fontWeight: "700", color: "#8A5A00" },
});
