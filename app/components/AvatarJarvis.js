import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { COLORS } from "../constants/colors";

const TAMANO = 160;
const N_BARRAS = 13;
const N_PARTICULAS = 8;

// Colores del orbe según lo que hace Jarvis y, al hablar, según su emoción.
const TONOS = {
  inactivo: COLORS.primary,
  escuchando: COLORS.danger,
  pensando: "#7C3AED",
  hablando: COLORS.primary,
};
const TONOS_EMOCION = {
  excited: "#F59E0B",
  cheerfully: "#F97316",
  laughs: "#EC4899",
  warmly: "#2563EB",
  sympathetic: "#0EA5E9",
  sighs: "#64748B",
  curious: "#8B5CF6",
};
const FELIZ = ["excited", "cheerfully", "laughs", "warmly"];
const TRISTE = ["sympathetic", "sighs"];

const loopDe = (anim) => Animated.loop(anim);
const t = (valor, toValue, duration, easing = Easing.inOut(Easing.sin)) =>
  Animated.timing(valor, { toValue, duration, easing, useNativeDriver: true });

/**
 * Avatar animado de Jarvis para el modo voz.
 * estado: "inactivo" | "escuchando" | "pensando" | "hablando"
 * nivel: volumen del micrófono 0..1 (el orbe y las barras siguen tu voz)
 * emocion: etiqueta de la respuesta (excited, warmly, sympathetic…) para su expresión
 */
export default function AvatarJarvis({ estado = "inactivo", nivel = 0, emocion = null }) {
  const escala = useRef(new Animated.Value(1)).current;
  const boca = useRef(new Animated.Value(0.15)).current;
  const parpadeo = useRef(new Animated.Value(1)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const orbita = useRef(new Animated.Value(0)).current;
  const cabeceo = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const mirada = useRef(new Animated.Value(0)).current;
  const onda1 = useRef(new Animated.Value(0)).current;
  const onda2 = useRef(new Animated.Value(0)).current;
  const onda3 = useRef(new Animated.Value(0)).current;
  const barras = useMemo(() => Array.from({ length: N_BARRAS }, () => new Animated.Value(0.12)), []);

  const hablando = estado === "hablando";
  const emo = hablando ? emocion : null;
  const feliz = FELIZ.includes(emo);
  const triste = TRISTE.includes(emo);
  const curioso = emo === "curious";
  const energia = emo === "excited" || emo === "laughs" ? 1.5 : triste ? 0.6 : 1;

  // Parpadeo natural y miradas a los lados, siempre.
  useEffect(() => {
    const loops = [
      loopDe(Animated.sequence([Animated.delay(2600), t(parpadeo, 0.1, 80), t(parpadeo, 1, 120)])),
      loopDe(Animated.sequence([
        Animated.delay(3500), t(mirada, -1, 300), Animated.delay(700), t(mirada, 1, 400),
        Animated.delay(700), t(mirada, 0, 300),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [parpadeo, mirada]);

  // Animación principal según el estado.
  useEffect(() => {
    const ondas = (duracion) => [onda1, onda2, onda3].map((v, i) =>
      loopDe(Animated.sequence([
        Animated.delay((duracion / 3) * i),
        t(v, 1, duracion, Easing.out(Easing.quad)),
        t(v, 0, 0),
      ]))
    );
    let loops = [];

    if (hablando) {
      const pulsos = [];
      const bocas = [];
      for (let i = 0; i < 10; i++) {
        const fuerza = (0.3 + Math.random() * 0.7) * energia;
        const dur = (100 + Math.random() * 120) / Math.min(energia, 1.2);
        pulsos.push(t(escala, 1 + fuerza * 0.1, dur), t(escala, 1, dur));
        bocas.push(t(boca, Math.min(1, 0.35 + fuerza * 0.6), dur), t(boca, 0.2, dur));
      }
      loops = [
        loopDe(Animated.sequence(pulsos)),
        loopDe(Animated.sequence(bocas)),
        // Ecualizador: cada barra con su propio ritmo.
        ...barras.map((b) => {
          const pasos = [];
          for (let i = 0; i < 6; i++) {
            const dur = 120 + Math.random() * 160;
            pasos.push(t(b, Math.min(1, (0.25 + Math.random() * 0.75) * energia), dur), t(b, 0.15, dur));
          }
          return loopDe(Animated.sequence(pasos));
        }),
        loopDe(t(orbita, 1, 6000 / energia, Easing.linear)),
        // Cabeceo suave, como quien conversa (más marcado si ríe o se emociona).
        loopDe(Animated.sequence([t(cabeceo, 1, 700 / energia), t(cabeceo, -1, 700 / energia)])),
        loopDe(Animated.sequence([t(halo, 1, 900), t(halo, 0.4, 900)])),
        ...ondas(1500 / energia),
      ];
    } else if (estado === "pensando") {
      loops = [
        loopDe(t(giro, 1, 1400, Easing.linear)),
        loopDe(t(orbita, 1, 2500, Easing.linear)),
        loopDe(Animated.sequence([t(escala, 0.94, 600), t(escala, 1, 600)])),
        loopDe(Animated.sequence([t(halo, 0.6, 600), t(halo, 0.2, 600)])),
      ];
    } else if (estado === "escuchando") {
      loops = [...ondas(1100), loopDe(Animated.sequence([t(halo, 0.8, 500), t(halo, 0.3, 500)]))];
    } else {
      loops = [
        loopDe(Animated.sequence([t(escala, 1.04, 1800), t(escala, 1, 1800)])),
        loopDe(Animated.sequence([t(halo, 0.35, 1800), t(halo, 0.1, 1800)])),
      ];
    }
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
      [onda1, onda2, onda3, giro, orbita, cabeceo].forEach((v) => v.setValue(0));
      escala.setValue(1);
      boca.setValue(0.15);
      barras.forEach((b) => b.setValue(0.12));
    };
  }, [estado, hablando, energia, escala, boca, giro, orbita, cabeceo, halo, onda1, onda2, onda3, barras]);

  // Mientras escucha, el orbe y las barras siguen el volumen de tu voz.
  useEffect(() => {
    if (estado !== "escuchando") return;
    Animated.spring(escala, { toValue: 1 + nivel * 0.3, speed: 40, bounciness: 4, useNativeDriver: true }).start();
    barras.forEach((b, i) => {
      const forma = 1 - Math.abs(i - (N_BARRAS - 1) / 2) / N_BARRAS; // más altas al centro
      Animated.spring(b, { toValue: Math.max(0.12, nivel * forma * (0.7 + Math.random() * 0.3)),
        speed: 50, bounciness: 2, useNativeDriver: true }).start();
    });
  }, [estado, nivel, escala, barras]);

  const tono = (emo && TONOS_EMOCION[emo]) || TONOS[estado] || COLORS.primary;
  const estiloOnda = (valor) => ({
    borderColor: tono,
    opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: valor.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });
  const rotar = (v, vueltas = 1) => v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${360 * vueltas}deg`] });
  const inclinacion = cabeceo.interpolate({ inputRange: [-1, 1], outputRange: curioso ? ["8deg", "14deg"] : ["-4deg", "4deg"] });
  const saltito = cabeceo.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, -6 * energia, 0] });
  const ojosX = mirada.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const verParticulas = hablando || estado === "pensando";

  return (
    <View style={styles.contenedor} accessibilityLabel={`Jarvis ${estado}`}>
      {/* Halo de luz que respira */}
      <Animated.View style={[styles.halo, { backgroundColor: tono, opacity: halo.interpolate({
        inputRange: [0, 1], outputRange: [0, 0.35] }), transform: [{ scale: halo.interpolate({
        inputRange: [0, 1], outputRange: [1.1, 1.45] }) }] }]} />

      <Animated.View style={[styles.onda, estiloOnda(onda1)]} />
      <Animated.View style={[styles.onda, estiloOnda(onda2)]} />
      <Animated.View style={[styles.onda, estiloOnda(onda3)]} />

      {/* Partículas que orbitan mientras habla o piensa */}
      {verParticulas ? (
        <>
          <Animated.View style={[styles.orbita, { transform: [{ rotate: rotar(orbita) }] }]}>
            {Array.from({ length: N_PARTICULAS }, (_, i) => (
              <View key={i} style={[styles.particula, posicionEnCirculo(i, N_PARTICULAS, TAMANO * 0.82),
                { backgroundColor: i % 2 ? COLORS.white : tono, opacity: 0.5 + (i % 3) * 0.2 }]} />
            ))}
          </Animated.View>
          <Animated.View style={[styles.orbita, { transform: [{ rotate: rotar(orbita, -0.6) }] }]}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={[styles.chispa, posicionEnCirculo(i, 5, TAMANO * 0.68),
                { backgroundColor: feliz ? COLORS.accent : COLORS.secondary }]} />
            ))}
          </Animated.View>
        </>
      ) : null}

      {estado === "pensando" ? (
        <Animated.View style={[styles.arco, { borderTopColor: tono, borderRightColor: tono,
          transform: [{ rotate: rotar(giro) }] }]} />
      ) : null}

      {/* La cabeza: orbe con cara */}
      <Animated.View style={{ transform: [{ translateY: saltito }, { rotate: inclinacion }] }}>
        <Animated.View style={[styles.orbe, { backgroundColor: tono, transform: [{ scale: escala }] }]}>
          <View style={styles.brillo} />

          {triste ? (
            <View style={styles.cejas}>
              <View style={[styles.ceja, { transform: [{ rotate: "-18deg" }] }]} />
              <View style={[styles.ceja, { transform: [{ rotate: "18deg" }] }]} />
            </View>
          ) : null}

          <Animated.View style={[styles.ojos, { transform: [{ translateX: ojosX }] }]}>
            {feliz ? (
              <>
                <View style={styles.ojoFeliz} />
                <View style={styles.ojoFeliz} />
              </>
            ) : (
              <>
                <Animated.View style={[styles.ojo, triste && styles.ojoTriste, { transform: [{ scaleY: parpadeo }] }]} />
                <Animated.View style={[styles.ojo, triste && styles.ojoTriste, curioso && styles.ojoCurioso,
                  { transform: [{ scaleY: parpadeo }] }]} />
              </>
            )}
          </Animated.View>

          {feliz ? (
            <View style={styles.mejillas}>
              <View style={styles.mejilla} />
              <View style={styles.mejilla} />
            </View>
          ) : null}

          <Animated.View style={[styles.boca, feliz && styles.bocaFeliz, { transform: [{ scaleY: boca }] }]} />
        </Animated.View>
      </Animated.View>

      {/* Ecualizador de voz */}
      <View style={styles.barras}>
        {barras.map((b, i) => (
          <Animated.View key={i} style={[styles.barra, { backgroundColor: i % 3 === 1 ? COLORS.white : tono,
            transform: [{ scaleY: b }] }]} />
        ))}
      </View>
    </View>
  );
}

function posicionEnCirculo(i, total, radio) {
  const angulo = (2 * Math.PI * i) / total;
  return { transform: [{ translateX: Math.cos(angulo) * radio }, { translateY: Math.sin(angulo) * radio }] };
}

const styles = StyleSheet.create({
  contenedor: { width: TAMANO * 2.1, height: TAMANO * 2.4, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: TAMANO, height: TAMANO, borderRadius: TAMANO / 2 },
  onda: { position: "absolute", width: TAMANO, height: TAMANO, borderRadius: TAMANO / 2, borderWidth: 3 },
  orbita: { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  particula: { position: "absolute", width: 9, height: 9, borderRadius: 5 },
  chispa: { position: "absolute", width: 5, height: 5, borderRadius: 3 },
  arco: { position: "absolute", width: TAMANO + 34, height: TAMANO + 34, borderRadius: (TAMANO + 34) / 2,
    borderWidth: 4, borderColor: "transparent" },
  orbe: { width: TAMANO, height: TAMANO, borderRadius: TAMANO / 2, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  brillo: { position: "absolute", top: 16, left: 28, width: 48, height: 26, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.28)", transform: [{ rotate: "-25deg" }] },
  cejas: { position: "absolute", top: 40, flexDirection: "row", gap: 30 },
  ceja: { width: 22, height: 4, borderRadius: 2, backgroundColor: COLORS.white },
  ojos: { flexDirection: "row", gap: 32, marginTop: -4, alignItems: "center", height: 30 },
  ojo: { width: 17, height: 28, borderRadius: 9, backgroundColor: COLORS.white },
  ojoTriste: { height: 20, marginTop: 6 },
  ojoCurioso: { height: 32, width: 20 },
  // Ojos "^ ^" de felicidad.
  ojoFeliz: { width: 24, height: 13, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderWidth: 4,
    borderBottomWidth: 0, borderColor: COLORS.white },
  mejillas: { position: "absolute", top: 92, flexDirection: "row", gap: 74 },
  mejilla: { width: 18, height: 10, borderRadius: 5, backgroundColor: "rgba(255,182,193,0.7)" },
  boca: { width: 42, height: 24, borderRadius: 12, backgroundColor: COLORS.white, marginTop: 16 },
  bocaFeliz: { width: 54, borderBottomLeftRadius: 27, borderBottomRightRadius: 27, borderTopLeftRadius: 6,
    borderTopRightRadius: 6 },
  barras: { position: "absolute", bottom: 0, flexDirection: "row", alignItems: "center", gap: 5, height: 50 },
  barra: { width: 6, height: 46, borderRadius: 3 },
});
