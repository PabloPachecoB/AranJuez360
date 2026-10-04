import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { COLORS } from "../constants/colors";

export default function PrimaryButton({ title, onPress, loading, disabled, variant = "primary", style }) {
  const outline = variant === "outline";
  const inactivo = loading || disabled;
  return (
    <TouchableOpacity
      style={[styles.button, outline && styles.outline, inactivo && styles.disabled, style]}
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={outline ? COLORS.primary : COLORS.white} />
      ) : (
        <Text style={[styles.text, outline && styles.outlineText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.primary },
  disabled: { opacity: 0.55 },
  text: { color: COLORS.white, fontWeight: "700", fontSize: 16 },
  outlineText: { color: COLORS.primary },
});
