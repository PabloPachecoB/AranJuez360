import { StyleSheet, View } from "react-native";
import JarvisCuerpo from "./JarvisCuerpo";

/** Personaje completo; conserva el contrato del modo voz existente. */
export default function AvatarJarvis({ estado = "inactivo", nivel = 0, emocion = null }) {
  return (
    <View style={styles.contenedor}>
      <JarvisCuerpo ancho={210} estado={estado} nivel={nivel} emocion={estado === "hablando" ? emocion : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
});
