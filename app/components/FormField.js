import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/** Campo con etiqueta, ayuda, error y opción de mostrar/ocultar contraseña. */
export default function FormField({ label, error, hint, secure, ...inputProps }) {
  const [oculto, setOculto] = useState(true);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={secure && oculto}
          accessibilityLabel={label}
          {...inputProps}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setOculto(!oculto)}
            accessibilityLabel={oculto ? "Mostrar contraseña" : "Ocultar contraseña"}
            hitSlop={12}
          >
            <Ionicons name={oculto ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
  },
  inputError: { borderColor: COLORS.danger },
  input: { flex: 1, paddingVertical: 13, color: COLORS.text, fontSize: 15 },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 5 },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 5 },
});
