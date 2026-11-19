import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES } from "../constants/theme";

const ORO = "#F5B301";
const ORO_OSCURO = "#8A5A00";
const ORO_CLARO = "#FFF4CC";
const DESTELLO_CADA_MS = 4500;
const ANCHO = 92;

const t = (valor, toValue, duration, easing = Easing.out(Easing.quad)) =>
  Animated.timing(valor, { toValue, duration, easing, useNativeDriver: true });

/** Cuenta animada hasta `valor` (el saldo "sube" cuando cambia). */
function useConteo(valor, duracion = 900) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    const inicio = desde.current;
    if (inicio === valor) return undefined;
    const t0 = Date.now();
    let frame;
    const paso = () => {
      const p = Math.min(1, (Date.now() - t0) / duracion);
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrado(Math.round((inicio + (valor - inicio) * suave) * 100) / 100);
      if (p < 1) frame = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion]);
  return mostrado;
}

/** Cartera de Paseo Points para el encabezado: monedas, saldo y un destello periódico. */
export default function CarteraPuntos({ saldo: saldoApi = 0, onPress }) {
  const saldo = Number(saldoApi) || 0; // la API manda decimales como texto ("416.75")
  const barrido = useRef(new Animated.Value(0)).current;
  const estrella = useRef(new Animated.Value(0)).current;
  const moneda = useRef(new Animated.Value(0)).current;
  const mostrado = useConteo(saldo);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(DESTELLO_CADA_MS),
        Animated.parallel([
          // Brillo que cruza la cartera de izquierda a derecha.
          t(barrido, 1, 750, Easing.inOut(Easing.quad)),
          // La moneda de adelante gira como si le diera la luz.
          Animated.sequence([t(moneda, 1, 380), t(moneda, 0, 380)]),
          // Estrellita que aparece y desaparece.
          Animated.sequence([
            Animated.delay(250),
            Animated.spring(estrella, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: true }),
            t(estrella, 0, 300),
          ]),
        ]),
        t(barrido, 0, 0),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [barrido, estrella, moneda]);

  const xBarrido = barrido.interpolate({ inputRange: [0, 1], outputRange: [-40, ANCHO + 20] });
  const giroMoneda = moneda.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.cartera}
      accessibilityRole="button" accessibilityLabel={`Tienes ${saldo} monedas`}>
      <View style={styles.monedas}>
        <View style={[styles.moneda, styles.monedaAtras]} />
        <Animated.View style={[styles.moneda, { transform: [{ scaleX: giroMoneda }] }]}>
          <Text style={styles.monedaLetra}>P</Text>
        </Animated.View>
      </View>
      <View>
        <Text style={styles.saldo} numberOfLines={1}>{mostrado.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</Text>
        <Text style={styles.etiqueta}>monedas</Text>
      </View>

      <Animated.View pointerEvents="none" style={[styles.barrido, { transform: [{ translateX: xBarrido }, { rotate: "20deg" }] }]} />
      <Animated.View pointerEvents="none" style={[styles.estrella, { opacity: estrella, transform: [
        { scale: estrella }, { rotate: estrella.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) },
      ] }]}>
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cartera: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: ANCHO, height: 38, paddingLeft: 6,
    paddingRight: 12, borderRadius: 999, backgroundColor: ORO_CLARO, borderWidth: 1.5, borderColor: ORO,
    overflow: "hidden" },
  monedas: { width: 30, height: 26, justifyContent: "center" },
  moneda: { position: "absolute", left: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: ORO,
    borderWidth: 2, borderColor: "#FFD966", alignItems: "center", justifyContent: "center" },
  monedaAtras: { left: 0, top: 3, backgroundColor: "#D99A00", borderColor: "#F5B301" },
  monedaLetra: { color: ORO_OSCURO, fontFamily: FUENTES.titulo, fontSize: 12 },
  saldo: { color: ORO_OSCURO, fontFamily: FUENTES.titulo, fontSize: 15, lineHeight: 17 },
  etiqueta: { color: "#A97400", fontFamily: FUENTES.textoMedio, fontSize: 9.5, lineHeight: 11 },
  barrido: { position: "absolute", top: -10, left: 0, width: 16, height: 60, backgroundColor: "rgba(255,255,255,0.75)" },
  estrella: { position: "absolute", top: 2, left: 22 },
});
