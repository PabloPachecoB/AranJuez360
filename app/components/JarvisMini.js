import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { FUENTES, STITCH } from "../constants/theme";

const TAMANO = 64;
const CAMBIO_MENSAJE_MS = 5000;

const t = (valor, toValue, duration, easing = Easing.inOut(Easing.sin)) =>
  Animated.timing(valor, { toValue, duration, easing, useNativeDriver: true });

/**
 * Jarvis en miniatura para el Inicio: flota, parpadea, mira a los lados, saluda
 * y muestra globos con consejos. Tocar abre el chat; mantener presionado, el modo voz.
 */
export default function JarvisMini({ mensajes = [], onPress, onLongPress }) {
  const flotar = useRef(new Animated.Value(0)).current;
  const parpadeo = useRef(new Animated.Value(1)).current;
  const mirada = useRef(new Animated.Value(0)).current;
  const saludo = useRef(new Animated.Value(0)).current;
  const brillo = useRef(new Animated.Value(0)).current;
  const globo = useRef(new Animated.Value(0)).current;
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([t(flotar, 1, 1600), t(flotar, 0, 1600)])),
      Animated.loop(Animated.sequence([Animated.delay(2400), t(parpadeo, 0.1, 80), t(parpadeo, 1, 110)])),
      Animated.loop(Animated.sequence([
        Animated.delay(3000), t(mirada, -1, 280), Animated.delay(600), t(mirada, 1, 380),
        Animated.delay(600), t(mirada, 0, 280),
      ])),
      // Cada tanto se "sacude" como saludando.
      Animated.loop(Animated.sequence([
        Animated.delay(4200),
        t(saludo, 1, 120), t(saludo, -1, 160), t(saludo, 1, 160), t(saludo, 0, 120),
      ])),
      Animated.loop(Animated.sequence([t(brillo, 1, 1400), t(brillo, 0, 1400)])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [flotar, parpadeo, mirada, saludo, brillo]);

  // Globo de texto: aparece, se queda y cambia de mensaje.
  useEffect(() => {
    if (!mensajes.length) return undefined;
    globo.setValue(0);
    const anim = Animated.sequence([
      Animated.spring(globo, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true }),
      Animated.delay(CAMBIO_MENSAJE_MS - 900),
      t(globo, 0, 300),
    ]);
    anim.start(({ finished }) => {
      if (finished) setIndice((i) => (i + 1) % mensajes.length);
    });
    return () => anim.stop();
  }, [indice, mensajes.length, globo]);

  const subir = flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sombra = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] });
  const inclinar = saludo.interpolate({ inputRange: [-1, 1], outputRange: ["-12deg", "12deg"] });
  const ojosX = mirada.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
  const mensaje = mensajes.length ? mensajes[indice % mensajes.length] : null;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.contenedor}
      accessibilityRole="button" accessibilityLabel="Jarvis, tu asistente. Toca para chatear, mantén presionado para hablar.">
      {mensaje ? (
        <Animated.View style={[styles.globo, { opacity: globo, transform: [
          { scale: globo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          { translateY: globo.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
        ] }]}>
          <Text style={styles.globoTexto} numberOfLines={2}>{mensaje}</Text>
          <View style={styles.globoPico} />
        </Animated.View>
      ) : null}

      <Animated.View style={{ transform: [{ translateY: subir }, { rotate: inclinar }] }}>
        <Animated.View style={[styles.halo, { opacity: brillo.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }),
          transform: [{ scale: brillo.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1.35] }) }] }]} />
        <View style={styles.orbe}>
          <View style={styles.reflejo} />
          <View style={styles.antena}><View style={styles.antenaBola} /></View>
          <Animated.View style={[styles.ojos, { transform: [{ translateX: ojosX }] }]}>
            <Animated.View style={[styles.ojo, { transform: [{ scaleY: parpadeo }] }]} />
            <Animated.View style={[styles.ojo, { transform: [{ scaleY: parpadeo }] }]} />
          </Animated.View>
          <View style={styles.sonrisa} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.sombra, { transform: [{ scaleX: sombra }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: "center", width: TAMANO + 16 },
  globo: { position: "absolute", bottom: TAMANO + 26, right: -4, width: 170, backgroundColor: STITCH.primary,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, zIndex: 10,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  globoTexto: { color: STITCH.white, fontSize: 12.5, lineHeight: 17, fontFamily: FUENTES.textoMedio },
  globoPico: { position: "absolute", bottom: -6, right: 30, width: 12, height: 12, backgroundColor: STITCH.primary,
    transform: [{ rotate: "45deg" }] },
  halo: { position: "absolute", width: TAMANO, height: TAMANO, borderRadius: TAMANO / 2,
    backgroundColor: STITCH.secondaryContainer },
  orbe: { width: TAMANO, height: TAMANO, borderRadius: TAMANO / 2, backgroundColor: STITCH.primaryContainer,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: STITCH.secondaryContainer,
    marginTop: 10 },
  reflejo: { position: "absolute", top: 8, left: 12, width: 20, height: 10, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.3)", transform: [{ rotate: "-25deg" }] },
  antena: { position: "absolute", top: -12, width: 3, height: 12, backgroundColor: STITCH.secondaryContainer,
    alignItems: "center" },
  antenaBola: { position: "absolute", top: -6, width: 9, height: 9, borderRadius: 5, backgroundColor: STITCH.oro },
  ojos: { flexDirection: "row", gap: 13, marginTop: -2 },
  ojo: { width: 8, height: 13, borderRadius: 4, backgroundColor: STITCH.white },
  sonrisa: { width: 18, height: 9, marginTop: 6, borderBottomLeftRadius: 9, borderBottomRightRadius: 9,
    borderWidth: 2.5, borderTopWidth: 0, borderColor: STITCH.white },
  sombra: { width: TAMANO * 0.7, height: 6, borderRadius: 3, backgroundColor: "rgba(0,50,75,0.15)", marginTop: 6 },
});
