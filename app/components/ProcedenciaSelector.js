import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { getProcedencias } from "../services/authService";
import FormField from "./FormField";

// Respaldo por si no hay conexión al abrir el registro (la lista oficial viene del backend).
const RESPALDO = [
  { valor: "CERCADO", nombre: "Cercado (ciudad de Cochabamba)" },
  { valor: "QUILLACOLLO", nombre: "Quillacollo (Quillacollo, Tiquipaya, Vinto, Colcapirhua, Sipe Sipe)" },
  { valor: "CHAPARE", nombre: "Chapare (Sacaba, Colomi, Villa Tunari)" },
  { valor: "ARANI", nombre: "Arani" },
  { valor: "ARQUE", nombre: "Arque" },
  { valor: "AYOPAYA", nombre: "Ayopaya" },
  { valor: "BOLIVAR", nombre: "Bolívar" },
  { valor: "CAPINOTA", nombre: "Capinota" },
  { valor: "CARRASCO", nombre: "Carrasco" },
  { valor: "ESTEBAN_ARCE", nombre: "Esteban Arce" },
  { valor: "GERMAN_JORDAN", nombre: "Germán Jordán" },
  { valor: "MIZQUE", nombre: "Mizque" },
  { valor: "NARCISO_CAMPERO", nombre: "Narciso Campero" },
  { valor: "PUNATA", nombre: "Punata" },
  { valor: "TAPACARI", nombre: "Tapacarí" },
  { valor: "TIRAQUE", nombre: "Tiraque" },
  { valor: "OTRO", nombre: "Otro lugar (fuera de Cochabamba)" },
];

/**
 * "¿De dónde eres?": provincia de Cochabamba u "Otro lugar" + ciudad.
 * value: { procedencia, ciudad_otra } · onChange(nuevoValor)
 */
export default function ProcedenciaSelector({ value, onChange, errores = {} }) {
  const [opciones, setOpciones] = useState(RESPALDO);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    getProcedencias().then((lista) => lista?.length && setOpciones(lista)).catch(() => {});
  }, []);

  const elegida = opciones.find((o) => o.valor === value.procedencia);
  const esOtro = value.procedencia === "OTRO";

  return (
    <View>
      <Text style={styles.label}>¿De dónde nos visitas?</Text>
      <Text style={styles.sub}>Si eres de Cochabamba, elige tu provincia. Si vienes de otro departamento o país, elige Otro lugar y escribe tu ciudad.</Text>
      <TouchableOpacity
        style={[styles.campo, errores.procedencia && styles.campoError]}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`De dónde eres: ${elegida?.nombre || "sin elegir"}`}
      >
        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.valor, !elegida && styles.placeholder]} numberOfLines={1}>
          {elegida ? elegida.nombre : "Elige tu provincia de Cochabamba u otro lugar"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
      </TouchableOpacity>
      {errores.procedencia ? <Text style={styles.error}>{errores.procedencia}</Text> : null}

      {esOtro ? (
        <View style={styles.ciudad}>
          <FormField label="¿De qué ciudad?" placeholder="Ej. La Paz, Santa Cruz, Oruro"
            value={value.ciudad_otra} onChangeText={(t) => onChange({ ...value, ciudad_otra: t })}
            error={errores.ciudad_otra} autoCapitalize="words" maxLength={80}
            hint="Escribe el nombre completo de tu ciudad." />
        </View>
      ) : null}

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)}>
          <Pressable style={styles.hoja}>
            <Text style={styles.titulo}>¿De dónde eres?</Text>
            <Text style={styles.sub}>Provincias del departamento de Cochabamba</Text>
            <FlatList
              data={opciones}
              keyExtractor={(o) => o.valor}
              renderItem={({ item }) => {
                const activa = item.valor === value.procedencia;
                return (
                  <TouchableOpacity
                    style={[styles.opcion, item.valor === "OTRO" && styles.opcionOtro]}
                    onPress={() => {
                      onChange({ procedencia: item.valor, ciudad_otra: item.valor === "OTRO" ? value.ciudad_otra : "" });
                      setAbierto(false);
                    }}
                  >
                    <Text style={[styles.opcionTexto, activa && styles.opcionActiva]}>{item.nombre}</Text>
                    {activa ? <Ionicons name="checkmark" size={20} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  campo: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12,
    paddingHorizontal: 12, height: 50, backgroundColor: COLORS.white, marginBottom: 4 },
  campoError: { borderColor: COLORS.danger },
  valor: { flex: 1, fontSize: 15, color: COLORS.text },
  placeholder: { color: COLORS.muted },
  error: { color: COLORS.danger, fontSize: 12, marginBottom: 8 },
  ciudad: { marginTop: 10 },
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  hoja: { maxHeight: "80%", backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 18, paddingHorizontal: 16, paddingBottom: 24 },
  titulo: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.muted, marginBottom: 10 },
  opcion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#EEF2F7", gap: 8 },
  opcionOtro: { borderTopWidth: 1, borderTopColor: "#CBD5E1", marginTop: 6 },
  opcionTexto: { flex: 1, fontSize: 15, color: COLORS.text },
  opcionActiva: { color: COLORS.primary, fontWeight: "700" },
});
