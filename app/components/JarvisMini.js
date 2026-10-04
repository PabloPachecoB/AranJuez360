import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { FUENTES, STITCH } from "../constants/theme";
import JarvisCuerpo, { useMovimientoJarvis } from "./JarvisCuerpo";

const TAMANO = 80;
const CAMBIO_MENSAJE_MS = 5000;

const t = (valor, toValue, duration, easing = Easing.inOut(Easing.sin)) =>
  Animated.timing(valor, { toValue, duration, easing, useNativeDriver: true, isInteraction: false });

/**
 * Jarvis en miniatura para el Inicio: flota, parpadea, mira a los lados, saluda
 * y muestra globos con consejos. Tocar abre el chat; mantener presionado, el modo voz.
 */
export default function JarvisMini({ mensajes = [], onPress, onLongPress }) {
  const movimiento = useMovimientoJarvis();
  const globo = useRef(new Animated.Value(1)).current;
  const [indice, setIndice] = useState(0);

  // Globo de texto: aparece, se queda y cambia de mensaje.
  useEffect(() => {
    if (!mensajes.length) return undefined;
    if (!movimiento) { globo.setValue(1); return undefined; }
    globo.setValue(0);
    const anim = Animated.sequence([
      Animated.spring(globo, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true, isInteraction: false }),
      Animated.delay(CAMBIO_MENSAJE_MS - 900),
      t(globo, 0, 300),
    ]);
    anim.start(({ finished }) => {
      if (finished) setIndice((i) => i + 1);
    });
    return () => anim.stop();
  }, [indice, mensajes.length, globo, movimiento]);

  const mensaje = mensajes.length ? mensajes[indice % mensajes.length] : null;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.contenedor}
      accessibilityRole="button" accessibilityLabel="Jarvis, tu asistente. Toca para chatear, mantén presionado para hablar.">
      {mensaje ? (
        <Animated.View style={[styles.globo, { opacity: globo, transform: [
          { scale: globo.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          { translateY: globo.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
        ] }]}>
          <Text style={styles.globoTexto} numberOfLines={2}>{mensaje}</Text>
          <View style={styles.globoPico} />
        </Animated.View>
      ) : null}

      <JarvisCuerpo ancho={TAMANO} saludar />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: "center", width: TAMANO },
  globo: { position: "absolute", bottom: TAMANO * 1.3 + 10, right: -4, width: 170, backgroundColor: STITCH.primary,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, zIndex: 10,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  globoTexto: { color: STITCH.white, fontSize: 12.5, lineHeight: 17, fontFamily: FUENTES.textoMedio },
  globoPico: { position: "absolute", bottom: -6, right: 30, width: 12, height: 12, backgroundColor: STITCH.primary,
    transform: [{ rotate: "45deg" }] },
});
