import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { STITCH } from "../constants/theme";

// Paleta de mascota: azul Paseo, cielo y un acento dorado de bienvenida.
const M = { tinta: STITCH.primary, cuerpo: "#288FC6", luz: "#55B7E4", sombra: "#1777AC",
  cara: "#BCEEFF", blanco: "#FFFFFF", oro: STITCH.oro, oroSombra: "#DE9924",
  mejilla: "#F995A5", boca: "#123B59", lengua: "#F48198" };
const ANCHO = 200;
const ALTO = 260;
const mover = (valor, destino, duration = 450) => Animated.timing(valor, {
  toValue: destino, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
  isInteraction: false,
});
const grados = (valor) => valor.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] });

export function useMovimientoJarvis() {
  const [reducido, setReducido] = useState(true);
  const [activo, setActivo] = useState(AppState.currentState === "active");
  useEffect(() => {
    let montado = true;
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (montado) setReducido(valor);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducido);
    const app = AppState.addEventListener("change", (estado) => setActivo(estado === "active"));
    return () => { montado = false; motion.remove(); app.remove(); };
  }, []);
  return !reducido && activo;
}

// El estado lo entrega la aplicación: este dibujo no detecta personas ni valida QR.
// Mirada: -1 (izquierda) .. 1 (derecha); null permite mirar alrededor en reposo.
export default function JarvisCuerpo({ ancho = 200, estado = "inactivo", emocion = null,
  nivel = 0, mirada = null, saludar = false, halo = true, animado = true }) {
  const permiteMovimiento = useMovimientoJarvis();
  const movimiento = permiteMovimiento && animado;
  const rig = useRef(null);
  if (!rig.current) {
    rig.current = Object.fromEntries(["respirar", "ojos", "parpadeo", "cabeza", "torso",
      "hombroI", "hombroD", "codoI", "codoD", "gesto", "boca", "escaner", "pulso", "rebote"]
      .map((key) => [key, new Animated.Value(key === "parpadeo" ? 1 : 0)]));
  }
  const r = rig.current;
  const pensando = estado === "pensando" || estado === "analizando";
  const hablando = estado === "hablando";
  const gesto = ({ excited: "feliz", cheerfully: "feliz", laughs: "feliz", warmly: "feliz",
    sympathetic: "triste", sighs: "triste", curious: "curioso", happy: "feliz", angry: "enojado",
    serious: "serio", surprised: "sorprendido" })[emocion] || emocion
    || (estado === "autorizado" ? "feliz" : estado === "denegado" ? "serio"
      : pensando || estado === "escuchando" ? "curioso" : "amable");
  const empatico = gesto === "triste";
  const alegre = gesto === "feliz";
  const enojado = gesto === "enojado";
  const serio = gesto === "serio";
  const curioso = gesto === "curioso";
  const sorprendido = gesto === "sorprendido";
  const tono = enojado ? "#EF8A72" : alegre || pensando ? M.oro : M.luz;

  useEffect(() => {
    if (!movimiento) {
      r.respirar.setValue(0); r.parpadeo.setValue(1);
      return undefined;
    }
    const animaciones = [
      Animated.loop(Animated.sequence([mover(r.respirar, 1, 1900), mover(r.respirar, 0, 1900)])),
      Animated.loop(Animated.sequence([Animated.delay(3100), mover(r.parpadeo, 0.12, 90),
        mover(r.parpadeo, 1, 130), Animated.delay(1700), mover(r.parpadeo, 0.12, 90), mover(r.parpadeo, 1, 130)])),
    ];
    animaciones.forEach((a) => a.start());
    return () => animaciones.forEach((a) => a.stop());
  }, [movimiento, r]);

  useEffect(() => {
    const destino = Number.isFinite(mirada) ? Math.max(-1, Math.min(1, mirada)) : 0;
    if (!movimiento) { r.ojos.setValue(destino); return undefined; }
    const anim = mirada !== null || estado !== "inactivo"
      ? mover(r.ojos, destino, 280)
      : Animated.loop(Animated.sequence([mover(r.ojos, 0), Animated.delay(3200), mover(r.ojos, -0.65),
        Animated.delay(1400), mover(r.ojos, 0.65, 650), Animated.delay(1900)]));
    anim.start();
    return () => anim.stop();
  }, [mirada, estado, movimiento, r]);

  useEffect(() => {
    const pose = enojado ? [-5, -3, 28, -28, -65, 65]
      : serio ? [0, 0, 8, -8, -8, 8]
      : sorprendido ? [-4, -3, 65, -65, -68, 68]
      : alegre ? [-7, -3, 24, -112, -30, -25]
      : pensando ? [10, 3, 12, -48, -15, -108]
      : estado === "escuchando" ? [-9, -3, 12, -22, -12, -48]
      : estado === "indicando" ? [-5, -5, 18, -92, -15, -12]
      : estado === "autorizado" ? [-5, -2, 12, -65, -10, -50]
      : estado === "denegado" || empatico ? [7, 2, 24, -24, -25, 25]
      : hablando ? [-3, -2, 25, -28, -38, 36] : [0, 0, 10, -10, -8, 8];
    const partes = [r.cabeza, r.torso, r.hombroI, r.hombroD, r.codoI, r.codoD];
    const transicion = Animated.parallel(partes.map((v, i) => mover(v, pose[i], movimiento ? 480 : 0)));
    transicion.start();
    r.rebote.setValue(0); r.gesto.setValue(0); r.boca.setValue(0); r.escaner.setValue(0); r.pulso.setValue(0);
    const animaciones = [];
    if (movimiento) {
      if (alegre || sorprendido) animaciones.push(Animated.sequence([
        mover(r.rebote, -0.25, 120),
        Animated.spring(r.rebote, { toValue: 1, speed: 18, bounciness: 9, useNativeDriver: true, isInteraction: false }),
        mover(r.rebote, 0, 350),
      ]));
      if (hablando) {
        animaciones.push(Animated.loop(Animated.sequence([mover(r.gesto, 1, 650), mover(r.gesto, -0.4, 850), mover(r.gesto, 0, 600)])));
        // Movimiento expresivo al hablar; no pretende sincronización de fonemas.
        animaciones.push(Animated.loop(Animated.sequence([mover(r.boca, 1, 170), mover(r.boca, 0.15, 120),
          mover(r.boca, 0.65, 210), mover(r.boca, 0, 190)])));
      }
      if (pensando) animaciones.push(Animated.loop(Animated.sequence([
        mover(r.escaner, 1, 1500), mover(r.escaner, 0, 1500)])));
      if (saludar && estado === "inactivo" && gesto === "amable") {
        animaciones.push(Animated.loop(Animated.sequence([
          Animated.delay(1800), Animated.parallel([mover(r.hombroD, -115, 650), mover(r.codoD, -35, 650)]),
          mover(r.codoD, 0, 250), mover(r.codoD, -35, 300), mover(r.codoD, 0, 300),
          Animated.parallel([mover(r.hombroD, -10, 750), mover(r.codoD, 8, 750)]), Animated.delay(10000),
        ])));
      }
    }
    animaciones.forEach((a) => a.start());
    return () => { transicion.stop(); animaciones.forEach((a) => a.stop()); };
  }, [estado, hablando, pensando, empatico, alegre, enojado, serio, sorprendido, gesto, saludar, movimiento, r]);

  useEffect(() => {
    const valor = Number.isFinite(nivel) ? Math.max(0, Math.min(1, nivel)) : 0;
    const anim = mover(r.pulso, estado === "escuchando" && movimiento ? valor : 0, 100);
    anim.start();
    return () => anim.stop();
  }, [nivel, estado, movimiento, r]);

  const brazo = (derecho) => (
    <Animated.View style={[s.brazo, { left: derecho ? 145 : 33, transform: [
      { rotate: grados(Animated.add(derecho ? r.hombroD : r.hombroI,
        Animated.multiply(r.gesto, derecho ? -10 : 8))) },
    ] }]}>
      <View style={s.hombro} />
      <View style={s.brazoSuperior} />
      <Animated.View style={[s.antebrazo, { transform: [{ rotate: grados(derecho ? r.codoD : r.codoI) }] }]}>
        <View style={s.codo} /><View style={s.manga} />
        <View style={s.mano}><View style={[s.pulgar, { left: derecho ? -3 : 20 }]} /><View style={s.dedos} /></View>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={{ width: ancho, height: ancho * ALTO / ANCHO }} pointerEvents="none"
      accessible accessibilityLabel={`Jarvis ${gesto}, ${estado}`}>
      <View style={[s.escala, { transform: [{ scale: ancho / ANCHO }] }]}>
        {halo && <Animated.View style={[s.halo, { borderColor: tono, backgroundColor: tono,
          opacity: r.respirar.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.14] }),
          transform: [{ scale: r.respirar.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
        }]} />}
        <Animated.View style={[s.sombra, { transform: [{ scaleX: r.respirar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] }]} />
        <Animated.View style={[s.figura, { transform: [
          { translateY: Animated.add(Animated.multiply(r.respirar, -3), Animated.multiply(r.rebote, -10)) },
          { scaleX: r.rebote.interpolate({ inputRange: [-0.25, 0, 1], outputRange: [1.025, 1, 0.98] }) },
          { scaleY: r.rebote.interpolate({ inputRange: [-0.25, 0, 1], outputRange: [0.97, 1, 1.04] }) },
          { rotate: grados(r.torso) },
        ] }]}>
          <View style={[s.pierna, { left: 71 }]}><View style={s.bota} /></View>
          <View style={[s.pierna, { left: 108 }]}><View style={s.bota} /></View>

          {brazo(false)}{brazo(true)}

          <View style={s.torso}>
            <View style={s.panel}>
              <Animated.View style={[s.insignia, { backgroundColor: tono, transform: [{ scale: r.pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }] }]}>
                <View style={s.sello} />
              </Animated.View>

            </View>
          </View>
          <View style={s.panuelo}><View style={s.nudo} /><View style={s.punta} /></View>
          <Animated.View style={[s.cabeza, { transform: [
            { translateX: Animated.multiply(r.ojos, 2) },
            { rotate: grados(Animated.add(r.cabeza, Animated.multiply(r.ojos, 4))) },
          ] }]}>
            <View style={s.antena}><View style={[s.antenaLuz, { backgroundColor: tono }]} /></View>
            <View style={s.reflejo} />
            <View style={s.visor}>
              <View style={s.cara}>
                <View style={s.cejas}>
                  {[0, 1].map(i => <View key={i} style={[s.ceja, { transform: [
                    { translateY: sorprendido ? -3 : serio ? 4 : curioso && i === 1 ? -4 : 0 },
                    { rotate: `${enojado ? (i ? -22 : 22) : empatico ? (i ? 18 : -18) : curioso ? (i ? 12 : -12) : (i ? 5 : -5)}deg` },
                  ] }]} />)}
                </View>
                <View style={s.ojos}>
                  {[0, 1].map(i => <Animated.View key={i} style={[s.ojo,
                    { transform: [{ scaleY: r.parpadeo }] }]}>
                    <Animated.View style={[s.pupila, sorprendido && s.pupilaPequena, {
                      transform: [{ translateX: Animated.multiply(r.ojos, 6) },
                        { translateY: curioso ? -3 : alegre ? 2 : 0 }],
                    }]}><View style={s.destello} /></Animated.View>
                    {(serio || enojado || empatico || alegre) && <View style={[s.parpado,
                      alegre ? s.parpadoFeliz : { top: enojado ? -3 : serio ? -5 : -9,
                        transform: [{ rotate: `${enojado ? (i ? -18 : 18) : empatico ? (i ? 12 : -12) : 0}deg` }] }]} />}
                  </Animated.View>)}
                </View>
                <View style={[s.mejilla, { left: 5, opacity: alegre ? 0.8 : 0.35 }]} />
                <View style={[s.mejilla, { right: 5, opacity: alegre ? 0.8 : 0.35 }]} />
                <Animated.View style={[s.boca, alegre && s.bocaFeliz, (serio || enojado) && s.bocaSeria,
                  empatico && s.bocaTriste, sorprendido && s.bocaSorpresa, curioso && s.bocaCuriosa,
                  { transform: [{ scaleY: r.boca.interpolate({ inputRange: [0, 1], outputRange: [1, serio || enojado ? 1.5 : 1.15] }) }] }]}>
                  {!(serio || enojado || empatico || sorprendido || curioso) && <><View style={s.dientes} /><View style={s.lengua} /></>}
                </Animated.View>
              </View>
              {pensando && <Animated.View style={[s.escaner, { transform: [{ translateY: r.escaner.interpolate({ inputRange: [0, 1], outputRange: [0, 45] }) }] }]} />}
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  escala: { width: ANCHO, height: ALTO, transformOrigin: "top left" },
  figura: { width: ANCHO, height: 242, transformOrigin: "100px 213px" },
  halo: { position: "absolute", top: 33, left: 7, width: 186, height: 186, borderRadius: 93, borderWidth: 2 },
  sombra: { position: "absolute", left: 50, top: 242, width: 100, height: 9, borderRadius: 50, backgroundColor: "rgba(60,120,160,0.17)" },
  cabeza: { position: "absolute", top: 28, left: 31, width: 138, height: 119, borderRadius: 49,
    borderBottomWidth: 7, borderColor: M.sombra, backgroundColor: M.cuerpo, transformOrigin: "69px 108px" },
  reflejo: { position: "absolute", top: 8, left: 22, width: 44, height: 9, borderRadius: 8, backgroundColor: M.luz },
  visor: { position: "absolute", top: 24, left: 12, width: 114, height: 82, borderRadius: 33, backgroundColor: M.cara, overflow: "hidden" },
  cara: { alignItems: "center", paddingTop: 16 },
  cejas: { position: "absolute", top: 9, flexDirection: "row", gap: 29 },
  ceja: { width: 22, height: 5, borderRadius: 5, backgroundColor: M.sombra },
  ojos: { flexDirection: "row", gap: 7, height: 43, alignItems: "center" },
  ojo: { width: 35, height: 42, borderRadius: 19, backgroundColor: M.blanco, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pupila: { width: 19, height: 27, borderRadius: 12, backgroundColor: M.tinta, alignItems: "flex-end", padding: 4 },
  pupilaPequena: { width: 15, height: 23 },
  destello: { width: 6, height: 8, borderRadius: 4, backgroundColor: M.blanco },
  parpado: { position: "absolute", left: -5, width: 45, height: 19, backgroundColor: M.cara },
  parpadoFeliz: { bottom: -11, borderRadius: 22, height: 22 },
  mejilla: { position: "absolute", top: 55, width: 16, height: 7, borderRadius: 8, backgroundColor: M.mejilla },
  boca: { width: 27, height: 14, marginTop: 3, borderTopLeftRadius: 4, borderTopRightRadius: 4,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: M.boca, overflow: "hidden" },
  bocaFeliz: { width: 35, height: 18, marginTop: 1 },
  bocaSeria: { width: 23, height: 4, borderRadius: 4, marginTop: 7 },
  bocaTriste: { width: 20, height: 8, marginTop: 7, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  bocaSorpresa: { width: 14, height: 18, borderRadius: 10, marginTop: 2 },
  bocaCuriosa: { width: 15, height: 6, borderRadius: 5, marginTop: 7, marginLeft: 12 },
  dientes: { position: "absolute", top: -1, left: 4, right: 4, height: 5, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: M.blanco },
  lengua: { position: "absolute", bottom: -4, left: 9, width: 20, height: 11, borderRadius: 10, backgroundColor: M.lengua },
  antena: { position: "absolute", top: -15, left: 65, width: 7, height: 19, borderRadius: 4, backgroundColor: M.sombra, transform: [{ rotate: "12deg" }] },
  antenaLuz: { position: "absolute", left: -5, top: -6, width: 17, height: 17, borderRadius: 7, borderBottomWidth: 3, borderColor: M.oroSombra },
  torso: { position: "absolute", left: 54, top: 131, width: 92, height: 81, borderRadius: 34,
    borderBottomWidth: 7, borderColor: M.sombra, backgroundColor: M.cuerpo },
  panel: { position: "absolute", left: 18, right: 18, top: 22, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: M.luz },
  insignia: { width: 27, height: 29, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sello: { width: 13, height: 16, borderWidth: 3, borderColor: M.tinta, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  panuelo: { position: "absolute", left: 64, top: 139, width: 74, height: 15, borderRadius: 8, backgroundColor: M.oro, transform: [{ rotate: "-5deg" }] },
  nudo: { position: "absolute", top: 2, right: 10, width: 16, height: 15, borderRadius: 6, backgroundColor: M.oroSombra },
  punta: { position: "absolute", right: -4, top: 10, width: 16, height: 27, borderBottomRightRadius: 12, borderBottomLeftRadius: 3, backgroundColor: M.oro, transform: [{ rotate: "-25deg" }] },
  brazo: { position: "absolute", top: 143, width: 22, height: 31, transformOrigin: "11px 9px" },
  hombro: { width: 22, height: 22, borderRadius: 11, backgroundColor: M.sombra },
  brazoSuperior: { position: "absolute", top: 3, left: 1, width: 20, height: 28, borderRadius: 11, backgroundColor: M.cuerpo },
  antebrazo: { position: "absolute", top: 22, width: 22, height: 37, transformOrigin: "11px 8px" },
  codo: { width: 22, height: 17, borderRadius: 10, backgroundColor: M.cuerpo },
  manga: { position: "absolute", top: 4, left: 1, width: 20, height: 22, borderRadius: 10, backgroundColor: M.cuerpo },
  mano: { position: "absolute", left: -3, top: 17, width: 28, height: 25, borderRadius: 11, backgroundColor: M.cara, borderBottomWidth: 3, borderColor: M.luz },
  pulgar: { position: "absolute", top: 1, width: 10, height: 15, borderRadius: 7, backgroundColor: M.cara },
  dedos: { position: "absolute", top: 10, left: 8, width: 12, height: 2, borderRadius: 1, backgroundColor: M.luz },
  pierna: { position: "absolute", top: 192, width: 23, height: 34, borderRadius: 11, backgroundColor: M.sombra },
  bota: { position: "absolute", top: 24, left: -8, width: 38, height: 22, borderRadius: 11, backgroundColor: M.cuerpo, borderBottomWidth: 5, borderColor: M.sombra },
  escaner: { position: "absolute", top: 3, left: 6, right: 6, height: 2, backgroundColor: M.sombra, opacity: 0.45 },
});
