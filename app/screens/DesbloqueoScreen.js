import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../components/PrimaryButton";
import SelloAnimado from "../components/SelloAnimado";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";

/** Acceso directo: hay sesión guardada; se desbloquea con huella / Face ID. */
export default function DesbloqueoScreen() {
  const { desbloquear, cerrarSesion } = useUserContext();
  const [intentando, setIntentando] = useState(false);

  const intentar = async () => {
    setIntentando(true);
    try {
      await desbloquear();
    } finally {
      setIntentando(false);
    }
  };

  useEffect(() => {
    intentar();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <SelloAnimado size={132} />
        <Text style={styles.title}>Paseo Aranjuez 360</Text>
        <Ionicons name="finger-print" size={36} color={COLORS.primary} style={styles.huella} />
        <Text style={styles.subtitle}>Usa tu huella o Face ID para entrar.</Text>
        <PrimaryButton title="Desbloquear" onPress={intentar} loading={intentando} style={styles.boton} />
        <PrimaryButton
          title="Entrar con correo y contraseña"
          variant="outline"
          onPress={cerrarSesion}
          style={styles.boton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "800", color: "#000", marginTop: 14 },
  huella: { marginTop: 18 },
  subtitle: { fontSize: 14, color: COLORS.muted, marginTop: 6, marginBottom: 28 },
  boton: { alignSelf: "stretch" },
});
