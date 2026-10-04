import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable } from "react-native";
import Svg, { G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { Sello } from "./SelloAnimado";

// Animación de entrada del login: las torres del Paseo (vistas desde abajo, como en
// assets/Torres gemelas modernas en línea arquitectónica.png) se trazan como un plano y se
// transforman en el logo "360 Paseo Aranjuez" (assets/paseo_aranjuez_logo.svg).
//   1. Contornos  2. Ventanales, coronas, columnas
//   3. Torre derecha → anillo del sello · torre izquierda → 3 y 6 · podio → franja
//   4. Sello y texto → logo final
// Todo vive en el sistema del logo (viewBox 1004 × 444). Tocar el logo salta al final.

const DURACION = 5000;
const T = {
  contorno: [0, 1500],
  detalle: [900, 2300],
  morph: [2600, 3800],
  numerosTrazo: [2700, 3600],
  numerosRelleno: [3400, 4100],
  sello: [3600, 4500],
  franja: [3700, 4400],
  texto: [4100, 5000],
};

const ANCHO = 1004;
const ALTO = 444;
const TINTA = "#111";
const FUENTE = Platform.select({ web: 'Inter, "Helvetica Neue", Arial, sans-serif', default: undefined });

const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // easeInOutCubic
const tramo = (t, [a, b]) => suave(Math.min(1, Math.max(0, (t - a) / (b - a))));
const mezcla = (a, b, p) => a + (b - a) * p;
const mezclaPunto = (a, b, p) => [mezcla(a[0], b[0], p), mezcla(a[1], b[1], p)];
const distancia = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
// Trazo progresivo: largo L (puede sobrar), p de 0 a 1
const trazo = (L, p) => ({ strokeDasharray: [L, L], strokeDashoffset: L * (1 - p) });

// ---------- Edificio ----------
// Puntos tomados de la imagen de referencia (1254 px) y llevados al sistema del logo.
const ESC = 0.37;
const P = ([x, y]) => [502 + (x - 640) * ESC, 4 + (y - 45) * ESC];
// Punto dentro de un cuadrilátero [arriba-izq, arriba-der, abajo-der, abajo-izq] (u horizontal, v vertical)
const enCuadro = ([a, b, c, d], u, v) => mezclaPunto(mezclaPunto(a, b, u), mezclaPunto(d, c, u), v);
const linea = (a, b) => ({ a, b, L: distancia(a, b) });
const polilinea = (pts) => ({
  d: `M${pts.map((p) => p.join(" ")).join(" L")}`,
  L: pts.slice(1).reduce((s, p, i) => s + distancia(pts[i], p), 0),
});
function ventanales(cuadro, columnas, filas) {
  const out = [];
  for (let k = 1; k < columnas; k++) out.push(linea(enCuadro(cuadro, k / columnas, 0), enCuadro(cuadro, k / columnas, 1)));
  for (let k = 1; k < filas; k++) out.push(linea(enCuadro(cuadro, 0, k / filas), enCuadro(cuadro, 1, k / filas)));
  return out;
}

// Torre izquierda (alta): cara lateral A-B-E-D y cara frontal B-C-F-E
const [A, B, C, D, E, F] = [[236, 345], [385, 112], [778, 262], [178, 872], [352, 812], [790, 830]].map(P);
const TORRE_IZQ = polilinea([D, A, B, C, F, E, D]);
const ARISTA_IZQ = linea(B, E);
const CORONA_IZQ = polilinea([[236, 345], [232, 322], [402, 48], [782, 192], [778, 262]].map(P));
const TECHO_IZQ = linea(P([548, 80]), P([778, 166]));

// Torre derecha (baja): su contorno se convierte en el anillo del sello
const TORRE_DER = [[792, 300], [1068, 415], [1112, 935], [800, 895]].map(P);
const FRANJA_DER = linea(P([840, 322]), P([846, 897]));
const CORONA_DER = linea(P([792, 318]), P([1068, 432]));

// Podio (se convierte en la franja) y base con columnas
const PODIO = [[148, 930], [1140, 965], [1148, 1150], [135, 1135]].map(P);
const PODIO_MEDIO = linea(P([138, 1060]), P([1145, 1095]));
const ESCALON = linea(P([165, 885]), P([790, 845]));
const PISO = linea(P([128, 1213]), P([1150, 1216]));
const COLUMNAS = [190, 240, 290, 390, 550, 730, 830, 975, 1065].map((x) => linea(P([x, 1142]), P([x, 1213])));

const DETALLES = [
  ...ventanales([B, C, F, E], 8, 11),
  ...ventanales([A, B, E, D], 3, 11),
  ...ventanales(TORRE_DER, 5, 10),
  FRANJA_DER,
  CORONA_DER,
  TECHO_IZQ,
  PODIO_MEDIO,
  ESCALON,
  ...COLUMNAS,
];

// ---------- Logo final (mismas formas que paseo_aranjuez_logo.svg) ----------
const NUMEROS = [
  { d: "M4 0 L310 0 L212 140 L87 140 L128 75 L4 75 Z", L: 1000 },
  { d: "M0 292 A154 150 0 0 0 308 292 L230 292 A76 65 0 0 1 78 292 Z", L: 1000 },
  { d: "M446 0 L566 0 L462 140 L342 140 Z", L: 700 },
  { d: "M292 292 A146 150 0 0 0 584 292 L516 292 A84 55 0 0 1 348 292 Z", L: 950 },
];
const SELLO = { cx: 790, cy: 222, escala: 2.11 }; // anillo exterior: r 95 × 2.11 ≈ 200, grosor 19
const ANILLO_R = 95 * SELLO.escala;
const FRANJA = { y: 140, alto: 152 };
const BANDA = [[0, FRANJA.y], [ANCHO, FRANJA.y], [ANCHO, FRANJA.y + FRANJA.alto], [0, FRANJA.y + FRANJA.alto]];

// Cuadrilátero → círculo con 4 curvas cúbicas (cada lado se vuelve un cuarto de círculo)
const K = 0.5523;
function cuadroACirculo(cuadro, p) {
  const angulos = [225, 315, 45, 135].map((g) => (g * Math.PI) / 180); // esquina → punto del círculo
  const enCirculo = (a) => [SELLO.cx + ANILLO_R * Math.cos(a), SELLO.cy + ANILLO_R * Math.sin(a)];
  const tangente = (a) => [-Math.sin(a), Math.cos(a)];
  let d = "";
  for (let i = 0; i < 4; i++) {
    const p0 = cuadro[i];
    const p3 = cuadro[(i + 1) % 4];
    const a0 = angulos[i];
    const a1 = angulos[(i + 1) % 4] + (i === 3 ? 2 * Math.PI : 0);
    const c0 = enCirculo(a0);
    const c3 = enCirculo(a1);
    const [t0, t1] = [tangente(a0), tangente(a1)];
    const q0 = mezclaPunto(p0, c0, p);
    const q1 = mezclaPunto(mezclaPunto(p0, p3, 1 / 3), [c0[0] + K * ANILLO_R * t0[0], c0[1] + K * ANILLO_R * t0[1]], p);
    const q2 = mezclaPunto(mezclaPunto(p0, p3, 2 / 3), [c3[0] - K * ANILLO_R * t1[0], c3[1] - K * ANILLO_R * t1[1]], p);
    const q3 = mezclaPunto(p3, c3, p);
    d += `${i === 0 ? `M${q0.join(" ")}` : ""} C${q1.join(" ")} ${q2.join(" ")} ${q3.join(" ")}`;
  }
  return `${d} Z`;
}
const PERIMETRO_DER = TORRE_DER.reduce((s, p, i) => s + distancia(p, TORRE_DER[(i + 1) % 4]), 0);

export default function IntroLogo({ width = 300, fondo = "#F8FAFC", onFin }) {
  const [t, setT] = useState(0);
  const reloj = useRef(new Animated.Value(0)).current;
  const avisado = useRef(false);

  const avisarFin = () => {
    if (avisado.current) return;
    avisado.current = true;
    onFin?.();
  };

  const saltar = () => {
    reloj.stopAnimation();
    reloj.setValue(DURACION);
    avisarFin();
  };

  // Un reloj lineal de 0 a DURACION ms; cada etapa toma su tramo con su propio easing
  useEffect(() => {
    const id = reloj.addListener(({ value }) => setT(value));
    const animacion = Animated.timing(reloj, {
      toValue: DURACION,
      duration: DURACION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animacion.start(({ finished }) => finished && avisarFin());
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((quieto) => quieto && saltar())
      .catch(() => {});
    return () => {
      animacion.stop();
      reloj.removeListener(id);
    };
  }, [reloj]);

  const contorno = tramo(t, T.contorno);
  const detalle = tramo(t, T.detalle);
  const morph = tramo(t, T.morph);
  const numerosTrazo = tramo(t, T.numerosTrazo);
  const numerosRelleno = tramo(t, T.numerosRelleno);
  const sello = tramo(t, T.sello);
  const franja = tramo(t, T.franja);
  const texto = tramo(t, T.texto);
  const desvanece = 1 - morph;

  const podio = PODIO.map((p, i) => mezclaPunto(p, BANDA[i], morph));
  const escalaSello = SELLO.escala * mezcla(0.92, 1, sello);

  return (
    <Pressable
      onPress={saltar}
      accessibilityRole="image"
      accessibilityLabel="Paseo Aranjuez 360"
      accessibilityHint="Toca para saltar la animación"
    >
      <Svg width={width} height={(width * ALTO) / ANCHO} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        <G fill="none" stroke={TINTA} strokeLinecap="round" strokeLinejoin="round">
          {/* ===== 1. Contornos ===== */}
          {/* Torre izquierda: se traza y se borra mientras nacen el 3 y el 6 */}
          <Path d={TORRE_IZQ.d} strokeWidth={2.4} {...trazo(TORRE_IZQ.L, contorno * (1 - morph))} />
          <Line
            x1={ARISTA_IZQ.a[0]}
            y1={ARISTA_IZQ.a[1]}
            x2={ARISTA_IZQ.b[0]}
            y2={ARISTA_IZQ.b[1]}
            strokeWidth={2.4}
            {...trazo(ARISTA_IZQ.L, contorno * (1 - morph))}
          />
          {/* Torre derecha → anillo exterior del sello */}
          <Path
            d={cuadroACirculo(TORRE_DER, morph)}
            strokeWidth={mezcla(2.4, 19, morph)}
            {...trazo(mezcla(PERIMETRO_DER, 2 * Math.PI * ANILLO_R, morph) + 4, contorno)}
          />
          {/* Podio → franja */}
          <Polygon
            points={podio.map((p) => p.join(",")).join(" ")}
            strokeWidth={2.4}
            opacity={1 - franja}
            {...trazo(2800, contorno)}
          />
          <Line
            x1={PISO.a[0]}
            y1={PISO.a[1]}
            x2={PISO.b[0]}
            y2={PISO.b[1]}
            strokeWidth={2.4}
            opacity={desvanece}
            {...trazo(PISO.L, contorno)}
          />

          {/* ===== 2. Detalles: coronas, ventanales, columnas ===== */}
          <G strokeWidth={1.2} opacity={desvanece}>
            <Path d={CORONA_IZQ.d} {...trazo(CORONA_IZQ.L, detalle)} />
            {DETALLES.map(({ a, b, L }, i) => (
              <Line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...trazo(L, detalle)} />
            ))}
          </G>
        </G>

        {/* ===== 3. El 3 y el 6: contorno fino que se rellena ===== */}
        {numerosTrazo > 0 &&
          NUMEROS.map(({ d, L }) => (
            <Path
              key={d}
              d={d}
              fill="#000"
              fillOpacity={numerosRelleno}
              stroke="#000"
              strokeWidth={2.4}
              strokeLinejoin="miter"
              {...trazo(L, numerosTrazo)}
            />
          ))}

        {/* ===== 4. Sello completo ===== */}
        {sello > 0 && (
          <G
            opacity={sello}
            transform={`translate(${SELLO.cx - 100 * escalaSello} ${SELLO.cy - 100 * escalaSello}) scale(${escalaSello})`}
          >
            <Sello color="#000" />
          </G>
        )}

        {/* Franja limpia que corta el logo + texto */}
        {franja > 0 && <Rect x={0} y={FRANJA.y} width={ANCHO} height={FRANJA.alto} fill={fondo} opacity={franja} />}
        {texto > 0 && (
          <SvgText
            x={480}
            y={250}
            textAnchor="middle"
            fontSize={100}
            fontWeight="700"
            fontFamily={FUENTE}
            letterSpacing={mezcla(24, 0, texto)}
            fill="#000"
            opacity={texto}
          >
            Paseo Aranjuez
          </SvgText>
        )}
      </Svg>
    </Pressable>
  );
}
