import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as LocalAuthentication from "expo-local-authentication";
import { FUENTES, STITCH } from "../constants/theme";
import { crearSolicitud, escanearPunto, resolverCodigo } from "../services/puntosService";

const ORO = "#F5B301";

// El QR/NFC puede traer solo el código o un enlace "paseo360://f/<código>" (o https://…/f/<código>).
export function extraerCodigo(texto) {
  const limpio = (texto || "").trim();
  // /f/<código> (formato actual) o /puntos/<código> (QR de caja impresos antes del cambio).
  const enlace = limpio.match(/\/(?:f|puntos)\/([A-Za-z0-9_-]{6,32})/);
  if (enlace) return enlace[1];
  return /^[A-Za-z0-9_-]{6,32}$/.test(limpio) ? limpio : null;
}

const fmt = (n) => Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });

async function confirmarIdentidad() {
  try {
    const [hardware, registrada] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !registrada) return true; // sin biometría configurada no se bloquea
    const { success } = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirma que eres tú" });
    return success;
  } catch {
    return true;
  }
}

/** Moneda que salta y gira al ganar. */
function MonedaGanada({ monedas }) {
  const salto = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(salto, { toValue: 1, speed: 6, bounciness: 14, useNativeDriver: true }),
      Animated.loop(Animated.timing(giro, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })),
    ]).start();
  }, [salto, giro]);
  return (
    <View style={styles.monedaCaja}>
      <Animated.View style={[styles.monedaGrande, {
        transform: [
          { scale: salto.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          { scaleX: giro.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.2, 1] }) },
        ],
      }]}>
        <Text style={styles.monedaLetra}>P</Text>
      </Animated.View>
      <Animated.Text style={[styles.monedasGanadas, { opacity: salto }]}>+{fmt(monedas)}</Animated.Text>
      <Text style={styles.monedasEtiqueta}>monedas</Text>
    </View>
  );
}

/**
 * Escáner único de fidelización: lee el QR (o recibe el código de un NFC por enlace)
 * y según el tipo cobra la visita/actividad o abre el formulario de compra.
 */
export default function EscanearScreen({ navigation, route }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [fase, setFase] = useState("camara"); // camara | cargando | compra | resultado | error
  const [codigo, setCodigo] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState("");
  const [nit, setNit] = useState("");
  const [monto, setMonto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const procesando = useRef(false);

  const procesar = useCallback(async (texto) => {
    if (procesando.current) return;
    const cod = extraerCodigo(texto);
    if (!cod) {
      setError("Este QR no es del Paseo Aranjuez.");
      setFase("error");
      return;
    }
    procesando.current = true;
    setCodigo(cod);
    setFase("cargando");
    try {
      const info = await resolverCodigo(cod);
      if (info.tipo === "COMPRA") {
        setEmpresa(info.empresa);
        setFase("compra");
      } else {
        const r = await escanearPunto(cod);
        setResultado({ ...r, titulo: info.tipo === "ENTRADA" ? "¡Bienvenido al Paseo!" : info.punto.nombre });
        setFase("resultado");
      }
    } catch (err) {
      setError(err.message);
      setFase("error");
    } finally {
      procesando.current = false;
    }
  }, []);

  // Abierto desde un NFC/enlace (paseo360://f/<código>): se procesa directo.
  const codigoEnlace = route?.params?.codigo;
  useEffect(() => {
    if (codigoEnlace) procesar(codigoEnlace);
  }, [codigoEnlace, procesar]);

  const reiniciar = () => {
    setFase("camara");
    setCodigo(null);
    setEmpresa(null);
    setResultado(null);
    setError(null);
    setNit("");
    setMonto("");
  };

  const enviarCompra = async () => {
    const valor = Number(monto.replace(",", "."));
    if (!/^\d{4,20}$/.test(nit)) return setError("El NIT debe tener solo dígitos (mínimo 4).");
    if (!valor || valor <= 0) return setError("Ingresa el monto de tu compra.");
    setError(null);
    if (!(await confirmarIdentidad())) return setError("No pudimos confirmar tu identidad.");
    setEnviando(true);
    try {
      await crearSolicitud({ codigo, nit, monto: valor.toFixed(2) });
      setResultado({ pendiente: true, titulo: empresa?.nombre,
        mensaje: "Tu compra fue enviada. El cajero revisará tu ticket y te acreditará las monedas." });
      setFase("resultado");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const camaraLista = permiso?.granted && fase === "camara";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.white} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Escanear y ganar</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          {fase === "camara" ? (
            <>
              <Text style={styles.ayuda}>
                Apunta al QR de la puerta, de una caja o de un juego. Con NFC, solo acerca tu teléfono.
              </Text>
              <View style={styles.visor}>
                {camaraLista ? (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={({ data }) => procesar(data)}
                  />
                ) : (
                  <View style={styles.sinCamara}>
                    <Ionicons name="camera-outline" size={40} color={STITCH.secondaryContainer} />
                    <Text style={styles.sinCamaraTexto}>Necesitamos la cámara para escanear.</Text>
                    <TouchableOpacity style={styles.boton} onPress={pedirPermiso}>
                      <Text style={styles.botonTexto}>Permitir cámara</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View pointerEvents="none" style={styles.marco} />
              </View>

              <View style={styles.tipos}>
                {[
                  ["log-in-outline", "Puerta", "cada visita"],
                  ["bag-handle-outline", "Compras", "según el monto"],
                  ["game-controller-outline", "Juegos", "cada actividad"],
                ].map(([icono, nombre, detalle]) => (
                  <View key={nombre} style={styles.tipo}>
                    <Ionicons name={icono} size={20} color={ORO} />
                    <Text style={styles.tipoNombre}>{nombre}</Text>
                    <Text style={styles.tipoDetalle}>{detalle}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.manualTitulo}>¿No puedes escanear? Ingresa el código</Text>
              <View style={styles.manualFila}>
                <TextInput style={styles.input} value={manual} onChangeText={setManual} autoCapitalize="none"
                  placeholder="Código del QR" placeholderTextColor={STITCH.outline} onSubmitEditing={() => procesar(manual)} />
                <TouchableOpacity style={styles.botonChico} onPress={() => procesar(manual)} accessibilityLabel="Usar código">
                  <Ionicons name="arrow-forward" size={20} color={STITCH.primary} />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {fase === "cargando" ? (
            <View style={styles.centro}>
              <ActivityIndicator size="large" color={ORO} />
              <Text style={styles.ayuda}>Validando código…</Text>
            </View>
          ) : null}

          {fase === "compra" && empresa ? (
            <View style={styles.tarjeta}>
              <Ionicons name="storefront" size={32} color={STITCH.primary} />
              <Text style={styles.tarjetaTitulo}>{empresa.nombre}</Text>
              <Text style={styles.tarjetaSub}>
                {empresa.piso ? `Piso ${empresa.piso}` : ""}{empresa.local ? ` · Local ${empresa.local}` : ""}
              </Text>
              <Text style={styles.label}>NIT de tu factura</Text>
              <TextInput style={styles.inputClaro} value={nit} onChangeText={setNit} keyboardType="number-pad"
                placeholder="Ej. 1234567" placeholderTextColor={STITCH.outline} />
              <Text style={styles.label}>Monto de la compra (Bs)</Text>
              <TextInput style={styles.inputClaro} value={monto} onChangeText={setMonto} keyboardType="decimal-pad"
                placeholder="Ej. 85,50" placeholderTextColor={STITCH.outline} />
              {error ? <Text style={styles.errorTexto}>{error}</Text> : null}
              <TouchableOpacity style={[styles.boton, styles.botonAncho]} onPress={enviarCompra} disabled={enviando}>
                {enviando ? <ActivityIndicator color={STITCH.primary} /> : <Text style={styles.botonTexto}>Enviar al cajero</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={reiniciar}><Text style={styles.enlace}>Cancelar</Text></TouchableOpacity>
            </View>
          ) : null}

          {fase === "resultado" && resultado ? (
            <View style={styles.centro}>
              {resultado.pendiente ? (
                <Ionicons name="time-outline" size={72} color={ORO} />
              ) : (
                <MonedaGanada monedas={resultado.monedas} />
              )}
              <Text style={styles.resultadoTitulo}>{resultado.titulo}</Text>
              <Text style={styles.resultadoTexto}>{resultado.mensaje}</Text>
              {resultado.saldo != null ? (
                <Text style={styles.saldo}>Tu saldo: {fmt(resultado.saldo)} monedas</Text>
              ) : null}
              <TouchableOpacity style={[styles.boton, styles.botonAncho]} onPress={reiniciar}>
                <Text style={styles.botonTexto}>Escanear otro</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.enlace}>Volver al inicio</Text></TouchableOpacity>
            </View>
          ) : null}

          {fase === "error" ? (
            <View style={styles.centro}>
              <Ionicons name="alert-circle" size={64} color="#FCA5A5" />
              <Text style={styles.resultadoTitulo}>No se pudo</Text>
              <Text style={styles.resultadoTexto}>{error}</Text>
              <TouchableOpacity style={[styles.boton, styles.botonAncho]} onPress={reiniciar}>
                <Text style={styles.botonTexto}>Intentar de nuevo</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.primary },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, height: 56 },
  iconBtn: { width: 40, padding: 4 },
  titulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 18 },
  contenido: { padding: 20, paddingTop: 4, flexGrow: 1 },
  ayuda: { color: "#c9d6e0", fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center", marginBottom: 16 },
  visor: { aspectRatio: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#0B2536",
    alignItems: "center", justifyContent: "center" },
  marco: { position: "absolute", width: "70%", height: "70%", borderRadius: 20, borderWidth: 3, borderColor: ORO },
  sinCamara: { alignItems: "center", gap: 10, padding: 20 },
  sinCamaraTexto: { color: STITCH.white, fontFamily: FUENTES.textoMedio, textAlign: "center" },
  tipos: { flexDirection: "row", gap: 10, marginTop: 18 },
  tipo: { flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 12 },
  tipoNombre: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 13, marginTop: 4 },
  tipoDetalle: { color: "#9fb3c2", fontFamily: FUENTES.texto, fontSize: 11 },
  manualTitulo: { color: "#9fb3c2", fontFamily: FUENTES.textoMedio, fontSize: 12.5, marginTop: 22, marginBottom: 8 },
  manualFila: { flexDirection: "row", gap: 8 },
  input: { flex: 1, height: 46, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.1)",
    color: STITCH.white, fontFamily: FUENTES.texto },
  botonChico: { width: 46, height: 46, borderRadius: 12, backgroundColor: STITCH.secondaryContainer, alignItems: "center",
    justifyContent: "center" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 30, gap: 8 },
  tarjeta: { backgroundColor: STITCH.white, borderRadius: 20, padding: 20, alignItems: "stretch", gap: 6 },
  tarjetaTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22, marginTop: 6 },
  tarjetaSub: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, marginBottom: 8 },
  label: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoFuerte, fontSize: 13, marginTop: 8 },
  inputClaro: { height: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: STITCH.surfaceLow,
    color: STITCH.onSurface, fontFamily: FUENTES.texto, fontSize: 16 },
  errorTexto: { color: STITCH.error, fontFamily: FUENTES.textoMedio, marginTop: 6 },
  boton: { backgroundColor: STITCH.secondaryContainer, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24,
    alignItems: "center", marginTop: 12 },
  botonAncho: { alignSelf: "stretch" },
  botonTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  enlace: { color: STITCH.secondaryContainer, fontFamily: FUENTES.textoFuerte, textAlign: "center", marginTop: 14 },
  monedaCaja: { alignItems: "center", marginBottom: 8 },
  monedaGrande: { width: 110, height: 110, borderRadius: 55, backgroundColor: ORO, borderWidth: 6, borderColor: "#FFD966",
    alignItems: "center", justifyContent: "center" },
  monedaLetra: { color: "#8A5A00", fontFamily: FUENTES.titulo, fontSize: 48 },
  monedasGanadas: { color: ORO, fontFamily: FUENTES.titulo, fontSize: 44, marginTop: 12 },
  monedasEtiqueta: { color: "#c9d6e0", fontFamily: FUENTES.textoMedio },
  resultadoTitulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 22, textAlign: "center", marginTop: 8 },
  resultadoTexto: { color: "#c9d6e0", fontFamily: FUENTES.texto, fontSize: 15, textAlign: "center", lineHeight: 22 },
  saldo: { color: ORO, fontFamily: FUENTES.textoFuerte, marginTop: 6 },
});
