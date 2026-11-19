import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";

// Sello circular de Paseo Aranjuez 360 (vectorial, mismo diseño que assets/logo-moneda.svg).
// Todo en negro; cada 4 s cruza una banda de luz recortada al círculo. La luz es blanca,
// así que sobre fondo claro solo se nota encima de la tinta negra.

const HOJA = "M0 0 Q6.5 -4.6 13 0 Q6.5 4.6 0 0 Z";
const ESTRELLA =
  "0,-7 1.646,-2.265 6.657,-2.163 2.663,0.865 4.114,5.663 0,2.8 -4.114,5.663 -2.663,0.865 -6.657,-2.163 -1.646,-2.265";
const RAYO = "98.4,88 101.6,88 100,44";
// Pares de hojas: ángulo desde arriba (horario) y escala (más chicas hacia la punta)
const PARES = [
  [45, 0.78], [57, 0.9], [69, 1], [81, 1], [93, 1], [105, 1], [117, 1], [129, 1], [141, 0.9],
];

function Rama({ color, espejo }) {
  return (
    <G transform={espejo ? "matrix(-1 0 0 1 200 0)" : undefined}>
      <Path
        d="M147.57 43.31 A74 74 0 0 1 141.38 161.35"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d={HOJA} fill={color} transform="rotate(37 100 100) translate(100 26) scale(.8) rotate(180)" />
      {PARES.map(([angulo, escala]) => (
        <G key={angulo} transform={`rotate(${angulo} 100 100) translate(100 26) scale(${escala})`}>
          <Path d={HOJA} fill={color} transform="rotate(206.6)" />
          <Path d={HOJA} fill={color} transform="rotate(153.4)" />
        </G>
      ))}
    </G>
  );
}

export function Sello({ color }) {
  const anillo = (r, grosor) => <Circle cx={100} cy={100} r={r} fill="none" stroke={color} strokeWidth={grosor} />;
  return (
    <G>
      {anillo(95, 9)}
      {anillo(86, 2)}
      {anillo(62, 1.5)}

      <Rama color={color} />
      <Rama color={color} espejo />

      <Polygon points={ESTRELLA} fill={color} transform="translate(100 26)" />
      <Polygon points={ESTRELLA} fill={color} transform="translate(100 174) rotate(180)" />

      {anillo(48, 1)}
      {anillo(38, 3.5)}
      {anillo(26, 1.5)}
      {anillo(19, 1)}
      <Circle cx={100} cy={100} r={12} fill={color} />
      {[0, 90, 180, 270].map((g) => (
        <Polygon key={g} points={RAYO} fill={color} transform={`rotate(${g} 100 100)`} />
      ))}
    </G>
  );
}

export default function SelloAnimado({ size = 120, color = "#000" }) {
  const avance = useRef(new Animated.Value(0)).current;
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setQuieto).catch(() => {});
  }, []);

  useEffect(() => {
    if (quieto) return undefined;
    // Barrido de 1,8 s y pausa hasta completar 4 s
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(avance, {
          toValue: 1,
          duration: 1800,
          easing: Easing.bezier(0.45, 0, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(avance, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [avance, quieto]);

  const banda = size * 0.45;
  const xBrillo = avance.interpolate({ inputRange: [0, 1], outputRange: [-banda * 1.6, size + banda * 0.6] });
  // El destello de la estrella superior aparece cuando la luz termina de pasar
  const opDestello = avance.interpolate({ inputRange: [0, 0.66, 0.85, 1], outputRange: [0, 0, 1, 0] });
  const escDestello = avance.interpolate({ inputRange: [0, 0.66, 0.85, 1], outputRange: [0.2, 0.2, 1, 0.2] });
  const giroDestello = avance.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Sello Paseo Aranjuez 360">
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Sello color={color} />
      </Svg>

      {!quieto && (
        <>
          <View style={[StyleSheet.absoluteFill, { pointerEvents: "none", borderRadius: size / 2, overflow: "hidden" }]}>
            <Animated.View
              style={{
                position: "absolute",
                top: -size * 0.25,
                width: banda,
                height: size * 1.5,
                transform: [{ translateX: xBrillo }, { rotate: "20deg" }],
              }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="luz" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <Stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
                    <Stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="10" height="10" fill="url(#luz)" />
              </Svg>
            </Animated.View>
          </View>

          <Animated.View
            style={{
              position: "absolute",
              pointerEvents: "none",
              left: size * 0.39,
              top: size * 0.02,
              width: size * 0.22,
              height: size * 0.22,
              opacity: opDestello,
              transform: [{ scale: escDestello }, { rotate: giroDestello }],
            }}
          >
            <Svg width="100%" height="100%" viewBox="89 15 22 22">
              <Path d="M100 15 L101.2 24.8 L111 26 L101.2 27.2 L100 37 L98.8 27.2 L89 26 L98.8 24.8 Z" fill="#fff" />
            </Svg>
          </Animated.View>
        </>
      )}
    </View>
  );
}
