import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import AvatarJarvis from "./AvatarJarvis";
import TarjetaAccion from "./TarjetaAccion";

// Cómo se muestra la emoción con la que Jarvis está hablando.
const EMOCIONES = {
  excited: "🤩 Emoción",
  cheerfully: "😄 Alegría",
  laughs: "😂 Risas",
  warmly: "😊 Amabilidad",
  sympathetic: "🤗 Empatía",
  sighs: "😌 Comprensión",
  curious: "🤔 Curiosidad",
};

const TEXTOS = {
  inactivo: "Toca el micrófono para hablar",
  escuchando: "Te escucho… toca para enviar",
  pensando: "Pensando…",
  hablando: "Toca para interrumpir",
};

/**
 * Modo voz: conversación tipo llamada con el avatar animado de Jarvis.
 * La lógica (grabar, enviar, hablar) vive en AsistenteScreen; aquí solo se muestra.
 */
export default function ModoVoz({ visible, estado, nivel, emocion, tuMensaje, respuesta, error, onMicrofono, onCerrar,
  accion, onConfirmar, onCancelar }) {
  const escuchando = estado === "escuchando";
  const pensando = estado === "pensando";
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <SafeAreaView style={styles.fondo}>
        <View style={styles.header}>
          <View>
            <Text style={styles.nombre}>Jarvis</Text>
            <Text style={styles.sub}>Asistente del Paseo Aranjuez</Text>
          </View>
          <TouchableOpacity onPress={onCerrar} style={styles.cerrar} accessibilityLabel="Cerrar modo voz">
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.centro}>
          <Pressable onPress={onMicrofono} disabled={pensando} accessibilityLabel={TEXTOS[estado]}>
            <AvatarJarvis estado={estado} nivel={nivel} emocion={emocion} />
          </Pressable>
          {estado === "hablando" && EMOCIONES[emocion] ? (
            <Text style={styles.emocion}>{EMOCIONES[emocion]}</Text>
          ) : null}
          <Text style={styles.estado}>{TEXTOS[estado]}</Text>
        </View>

        <View style={styles.subtitulos}>
          {tuMensaje ? <Text style={styles.tu} numberOfLines={2}>Tú: {tuMensaje}</Text> : null}
          {error ? (
            <Text style={styles.error} numberOfLines={3}>{error}</Text>
          ) : respuesta ? (
            <Text style={styles.respuesta} numberOfLines={5}>{respuesta}</Text>
          ) : null}
        </View>

        {accion ? <TarjetaAccion accion={accion} onConfirmar={onConfirmar} onCancelar={onCancelar} oscura /> : null}

        <View style={styles.controles}>
          <TouchableOpacity
            onPress={onMicrofono}
            disabled={pensando}
            style={[styles.mic, escuchando && styles.micActivo, pensando && styles.micDeshabilitado]}
            accessibilityLabel={escuchando ? "Enviar" : "Hablar"}
          >
            <Ionicons name={escuchando ? "arrow-up" : "mic"} size={34} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "#0B1437" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  nombre: { color: COLORS.white, fontSize: 22, fontWeight: "800" },
  sub: { color: "#94A3B8", fontSize: 13 },
  cerrar: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22, padding: 8 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  emocion: { color: COLORS.white, fontSize: 14, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, overflow: "hidden" },
  estado: { color: "#CBD5E1", fontSize: 15, fontWeight: "600", marginTop: 8 },
  subtitulos: { minHeight: 120, paddingHorizontal: 28, gap: 10, justifyContent: "flex-end" },
  tu: { color: "#94A3B8", fontSize: 14, textAlign: "center" },
  respuesta: { color: COLORS.white, fontSize: 18, lineHeight: 25, textAlign: "center", fontWeight: "500" },
  error: { color: "#FCA5A5", fontSize: 14, textAlign: "center" },
  controles: { alignItems: "center", paddingVertical: 28 },
  mic: { width: 78, height: 78, borderRadius: 39, backgroundColor: COLORS.primary, alignItems: "center",
    justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.25)" },
  micActivo: { backgroundColor: COLORS.danger },
  micDeshabilitado: { opacity: 0.4 },
});
