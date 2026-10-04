import { useCallback, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import IntroLogo from "../components/IntroLogo";
import { COLORS } from "../constants/colors";
import { login } from "../services/authService";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const formulario = useRef(new Animated.Value(0)).current;

  // El formulario aparece cuando el edificio termina de convertirse en el logo
  const mostrarFormulario = useCallback(() => {
    Animated.timing(formulario, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [formulario]);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const paso = await login(email, password);
      navigation.navigate("VerificarCodigo", paso);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <IntroLogo width={Math.min(width - 48, 340)} fondo={COLORS.bg} onFin={mostrarFormulario} />
          </View>
          <Animated.View
            style={{
              opacity: formulario,
              transform: [{ translateY: formulario.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Text style={styles.subtitle}>Visita, compra y acumula Paseo Points</Text>

            <FormField
              label="Correo"
              placeholder="tu@correo.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <FormField
              label="Contraseña"
              placeholder="Tu contraseña"
              secure
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
            />
            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton title="Continuar" onPress={onSubmit} loading={loading} />
            <Text style={styles.nota}>Te enviaremos un código a tu correo para confirmar que eres tú.</Text>

            <TouchableOpacity style={styles.link} onPress={() => navigation.navigate("Registro")}>
              <Text style={styles.linkText}>
                ¿No tienes cuenta? <Text style={styles.linkStrong}>Regístrate</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { alignSelf: "center", marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.muted, textAlign: "center", marginBottom: 32 },
  error: { color: COLORS.danger, marginBottom: 10, fontSize: 13 },
  nota: { color: COLORS.muted, fontSize: 12, textAlign: "center", marginTop: 12 },
  link: { marginTop: 28, alignItems: "center" },
  linkText: { color: COLORS.muted, fontSize: 14 },
  linkStrong: { color: COLORS.primary, fontWeight: "700" },
});
