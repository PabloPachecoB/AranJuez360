import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

const bs = (v) => `Bs ${Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Pedido de comida: cada plato con cantidad, precio y subtotal, y el total exacto que cobrará el QR. */
function DetallePedido({ detalle, oscura }) {
  return (
    <View style={styles.detalle}>
      <Text style={[styles.local, oscura && styles.claro]}>{detalle.local}</Text>
      {detalle.lineas.map((l) => (
        <View key={l.nombre} style={styles.linea}>
          <Text style={[styles.lineaNombre, oscura && styles.claro]} numberOfLines={2}>
            {l.cantidad} × {l.nombre}
            <Text style={styles.lineaUnitario}>  {bs(l.precio)} c/u</Text>
          </Text>
          <Text style={[styles.lineaSubtotal, oscura && styles.claro]}>{bs(l.subtotal)}</Text>
        </View>
      ))}
      <View style={styles.totalFila}>
        <Text style={[styles.totalTexto, oscura && styles.claro]}>Total</Text>
        <Text style={[styles.totalValor, oscura && styles.totalValorOscuro]}>{bs(detalle.total)}</Text>
      </View>
      <View style={styles.retiro}>
        <Ionicons name="time-outline" size={14} color={oscura ? "#CBD5E1" : COLORS.muted} />
        <Text style={[styles.retiroTexto, oscura && styles.claroSuave]}>{detalle.retiro} · pagas con QR al confirmar</Text>
      </View>
    </View>
  );
}

/** Propuesta de Jarvis (pedir, reservar, canjear, cancelar) que espera la confirmación del usuario. */
export default function TarjetaAccion({ accion, onConfirmar, onCancelar, oscura }) {
  const pendiente = accion.estado === "pendiente";
  const estados = { procesando: "Procesando…", confirmada: "✓ Hecho", cancelada: "Cancelado", fallida: "No se pudo" };
  const esPedido = accion.tipo === "pedir_comida" && accion.detalle?.lineas?.length;
  return (
    <View style={[styles.accion, oscura && styles.accionOscura]}>
      <View style={styles.accionCabecera}>
        <Ionicons name={esPedido ? "bag-handle" : accion.tipo === "canjear_recompensa" ? "gift" : "ticket"}
          size={18} color="#B7791F" />
        <Text style={[styles.accionTitulo, oscura && styles.accionTituloOscura]}>
          {esPedido ? "Tu pedido" : "¿Confirmas?"}
        </Text>
      </View>
      {esPedido ? <DetallePedido detalle={accion.detalle} oscura={oscura} /> : (
        <Text style={[styles.accionResumen, oscura && styles.accionResumenOscura]}>{accion.resumen}</Text>
      )}
      {pendiente ? (
        <View style={styles.accionBotones}>
          <TouchableOpacity style={styles.accionCancelar} onPress={() => onCancelar(accion)}>
            <Text style={styles.accionCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accionConfirmar} onPress={() => onConfirmar(accion)}>
            <Text style={styles.accionConfirmarTexto}>{esPedido ? "Confirmar y pagar" : "Confirmar"}</Text>
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
  detalle: { marginTop: 8, gap: 6 },
  local: { fontSize: 13, fontWeight: "700", color: COLORS.muted },
  linea: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  lineaNombre: { flex: 1, fontSize: 14.5, color: COLORS.text, fontWeight: "600", lineHeight: 20 },
  lineaUnitario: { fontSize: 12, color: COLORS.muted, fontWeight: "400" },
  lineaSubtotal: { fontSize: 14.5, color: COLORS.text, fontWeight: "700" },
  totalFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1,
    borderTopColor: "rgba(183,121,31,0.35)", paddingTop: 8, marginTop: 2 },
  totalTexto: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  totalValor: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  totalValorOscuro: { color: "#F5B301" },
  retiro: { flexDirection: "row", alignItems: "center", gap: 5 },
  retiroTexto: { flex: 1, fontSize: 12.5, color: COLORS.muted },
  claro: { color: COLORS.white },
  claroSuave: { color: "#CBD5E1" },
});
