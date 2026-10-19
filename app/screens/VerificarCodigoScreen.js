import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../components/PrimaryButton";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";
import { reenviarCodigo, verificarCodigo } from "../services/authService";
import { activarAccesoBiometrico, biometriaDisponible } from "../services/biometria";

const ESPERA_REENVIO = 60;

function preguntar(titulo, mensaje) {
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: "Ahora no", style: "cancel", onPress: () => resolve(false) },
      { text: "Activar", onPress: () => resolve(true) },
    ]);
  });
}

/** Sirve para verificar el correo (registro) y para el segundo factor del login. */
export default function VerificarCodigoScreen({ route, navigation }) {
  const { iniciarSesion } = useUserContext();
  const [desafio, setDesafio] = useState(route.params.desafio);
  const { paso, email, vence_en_minutos: minutos } = route.params;
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const input = useRef(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const verificar = async (valor = codigo) => {
    if (valor.length !== 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const usuario = await verificarCodigo(desafio, valor);
      if (Platform.OS !== "web" && (await biometriaDisponible())) {
        const activar = await preguntar(
          "Acceso directo",
          "¿Quieres entrar con tu huella o Face ID la próxima vez, sin escribir contraseña ni código?"
        );
        await activarAccesoBiometrico(activar);
      }
      iniciarSesion(usuario);
    } catch (err) {
      setError(err.message);
      setCodigo("");
      input.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onChange = (texto) => {
    const limpio = texto.replace(/\D/g, "").slice(0, 6);
    setCodigo(limpio);
    if (limpio.length === 6) verificar(limpio);
  };

  const reenviar = async () => {
    setError(null);
    try {
      const nuevo = await reenviarCodigo(desafio);
      setDesafio(nuevo.desafio);
      setEspera(ESPERA_REENVIO);
      setCodigo("");
    } catch (err) {
      setError(err.message);
    }
  };

  const titulo = paso === "verificar_correo" ? "Verifica tu correo" : "Confirma que eres tú";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Ionicons name="mail-open-outline" size={48} color={COLORS.primary} style={styles.icono} />
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.subtitle}>
          Enviamos un código de 6 dígitos a <Text style={styles.email}>{email}</Text>. Vence en {minutos} minutos.
        </Text>

        <TextInput
          ref={input}
          style={[styles.codigo, error && styles.codigoError]}
          value={codigo}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          placeholder="------"
          placeholderTextColor="#CBD5E1"
          accessibilityLabel="Código de verificación"
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton title="Verificar" onPress={() => verificar()} loading={loading} />

        <TouchableOpacity style={styles.reenviar} onPress={reenviar} disabled={espera > 0}>
          <Text style={[styles.reenviarTexto, espera > 0 && styles.reenviarInactivo]}>
            {espera > 0 ? `Reenviar código en ${espera} s` : "Reenviar código"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.nota}>¿No lo ves? Revisa tu carpeta de spam o promociones.</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  back: { alignSelf: "flex-start" },
  icono: { alignSelf: "center", marginTop: 24, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: "center", marginTop: 8, marginBottom: 28, lineHeight: 20 },
  email: { color: COLORS.text, fontWeight: "700" },
  codigo: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 32,
    letterSpacing: 14,
    textAlign: "center",
    paddingVertical: 16,
    color: COLORS.text,
    fontWeight: "700",
  },
  codigoError: { borderColor: COLORS.danger },
  error: { color: COLORS.danger, fontSize: 13, textAlign: "center", marginTop: 10 },
  reenviar: { marginTop: 22, alignItems: "center" },
  reenviarTexto: { color: COLORS.primary, fontWeight: "700" },
  reenviarInactivo: { color: COLORS.muted, fontWeight: "500" },
  nota: { color: COLORS.muted, fontSize: 12, textAlign: "center", marginTop: 10 },
});
