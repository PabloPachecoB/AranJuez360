import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

const ORO = "#F5B301";
const ORO_OSCURO = "#B7791F";
const ORO_CLARO = "#FDE68A";

/** Moneda dorada con la "P" de Paseo Points. */
function Moneda({ size = 34, style }) {
  return (
    <View style={[styles.moneda, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={[styles.monedaBorde, { borderRadius: size / 2 }]}>
        <Text style={[styles.monedaLetra, { fontSize: size * 0.45 }]}>P</Text>
      </View>
    </View>
  );
}

/** Pila de monedas que "caen" una tras otra al montar o al cambiar el saldo. */
function PilaMonedas({ saldo }) {
  const caidas = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    caidas.forEach((v) => v.setValue(0));
    Animated.stagger(
      120,
      caidas.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2)), useNativeDriver: true })
      )
    ).start();
  }, [saldo]);

  return (
    <View style={styles.pila} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {caidas.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.monedaPila,
            { left: i * 16, zIndex: 3 - i },
            {
              opacity: v,
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
            },
          ]}
        >
          <Moneda size={38} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Número que cuenta desde 0 hasta el saldo. */
function useContador(valor, duracion = 700) {
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const desde = 0;
    let frame;
    const paso = () => {
      const t = Math.min(1, (Date.now() - inicio) / duracion);
      // Las monedas tienen decimales (0,75 por visita): se cuenta al centavo.
      setMostrado(Math.round((desde + (valor - desde) * (1 - Math.pow(1 - t, 3))) * 100) / 100);
      if (t < 1) frame = requestAnimationFrame(paso);
    };
    paso();
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion]);
  return mostrado;
}

const fmt = (n) => Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });

export default function Monedero({ datos }) {
  // La API manda los decimales como texto ("416.75").
  const saldo = Number(datos?.saldo ?? 0);
  const siguiente = datos?.siguiente;
  const contador = useContador(saldo);
  const progreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progreso, {
      toValue: siguiente ? siguiente.progreso : 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [siguiente?.progreso]);

  return (
    <View style={styles.card} accessible accessibilityLabel={`Mi monedero: ${fmt(saldo)} monedas`}>
      <View style={styles.cabecera}>
        <Ionicons name="wallet-outline" size={18} color={ORO_CLARO} />
        <Text style={styles.titulo}>Mi monedero</Text>
        {datos?.recompensas_disponibles > 0 && (
          <View style={styles.badge}>
            <Ionicons name="gift" size={12} color={COLORS.primary} />
            <Text style={styles.badgeTexto}>
              {datos.recompensas_disponibles} para canjear
            </Text>
          </View>
        )}
      </View>

      <View style={styles.saldoFila}>
        <PilaMonedas saldo={saldo} />
        <View>
          <Text style={styles.saldo}>{fmt(contador)}</Text>
          <Text style={styles.saldoUnidad}>monedas</Text>
          {datos?.racha_visitas ? (
            <Text style={styles.saldoUnidad}>🔥 {datos.racha_visitas} {datos.racha_visitas === 1 ? "día" : "días"} seguidos viniendo al Paseo</Text>
          ) : null}
        </View>
      </View>

      {siguiente ? (
        <>
          <View style={styles.barra} accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(siguiente.progreso * 100) }}>
            <Animated.View
              style={[styles.barraRelleno, {
                width: progreso.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]}
            />
          </View>
          <Text style={styles.falta}>
            Te faltan <Text style={styles.faltaFuerte}>{fmt(siguiente.faltan_puntos)} monedas</Text> para{" "}
            <Text style={styles.faltaFuerte}>{siguiente.nombre}</Text>
          </Text>
          <Text style={styles.faltaBs}>Compra, juega o visita el Paseo para sumar más monedas</Text>
        </>
      ) : (
        <Text style={styles.falta}>¡Alcanzaste todas las recompensas! Canjea las que quieras.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.primary, borderRadius: 22, padding: 20, marginBottom: 20 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  titulo: { color: ORO_CLARO, fontWeight: "700", fontSize: 14, flex: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORO_CLARO,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexto: { color: COLORS.primary, fontSize: 11, fontWeight: "800" },
  saldoFila: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  pila: { width: 38 + 16 * 2, height: 40 },
  monedaPila: { position: "absolute", top: 0 },
  moneda: { backgroundColor: ORO, padding: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  monedaBorde: { flex: 1, borderWidth: 2, borderColor: ORO_OSCURO, alignItems: "center", justifyContent: "center" },
  monedaLetra: { color: ORO_OSCURO, fontWeight: "900" },
  saldo: { color: COLORS.white, fontSize: 40, fontWeight: "800", lineHeight: 44 },
  saldoUnidad: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  barra: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  barraRelleno: { height: "100%", borderRadius: 5, backgroundColor: ORO },
  falta: { color: COLORS.white, fontSize: 13, marginTop: 10 },
  faltaFuerte: { fontWeight: "800", color: ORO_CLARO },
  faltaBs: { color: "#CBD5E1", fontSize: 12, marginTop: 3 },
});
