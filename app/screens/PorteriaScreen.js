import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { useUserContext } from "../context/UserContext";
import { registrarIngresoOficina, registrarVisitaPaseo, validarInvitacion } from "../services/oficinasService";
import { getDiversion, registrarIngresoEvento } from "../services/diversionService";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const hora = (iso) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
const cuando = (iso) => {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  const dia = d.toDateString() === hoy.toDateString() ? "Hoy" : d.toDateString() === manana.toDateString()
    ? "Mañana" : `${DIAS[d.getDay()]} ${d.getDate()}`;
  return `${dia} · ${hora(iso)}`;
};

// "paseo360://evento/ABCD2345" → entrada a un evento con cupos (Escenario abierto).
function codigoEntradaEvento(texto) {
  const enlace = (texto || "").trim().match(/\/evento\/([A-Za-z0-9]{6,12})/);
  return enlace ? enlace[1].toUpperCase() : null;
}

// "paseo360://inv/ABCD2345" o el código suelto (8 caracteres) → invitación a oficina.
function codigoInvitacion(texto) {
  const limpio = (texto || "").trim();
  const enlace = limpio.match(/\/inv\/([A-Za-z0-9]{6,12})/);
  if (enlace) return enlace[1].toUpperCase();
  return /^[A-Za-z0-9]{8}$/.test(limpio) ? limpio.toUpperCase() : null;
}

/**
 * App del portero: solo tres cosas.
 *  1. Escanear QR (invitación a oficina, entrada a un evento con cupos, QR personal del cliente).
 *  2. Eventos disponibles (libres o con cupos).
 *  3. Cartelera de cine.
 */
export default function PorteriaScreen() {
  const { user, cerrarSesion } = useUserContext();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [pestana, setPestana] = useState("escanear");
  const [fase, setFase] = useState("camara"); // camara | cargando | invitacion | ok | error
  const [invitacion, setInvitacion] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [manual, setManual] = useState("");
  const [datos, setDatos] = useState(null); // { eventos, cartelera }
  const [errorCarga, setErrorCarga] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const ocupado = useRef(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await getDiversion());
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reiniciar = () => {
    setFase("camara");
    setInvitacion(null);
    setMensaje(null);
    setManual("");
  };

  const procesar = useCallback(async (texto) => {
    if (ocupado.current || !texto) return;
    ocupado.current = true;
    setFase("cargando");
    try {
      const entradaEvento = codigoEntradaEvento(texto);
      const codigo = entradaEvento ? null : codigoInvitacion(texto);
      if (entradaEvento) {
        const r = await registrarIngresoEvento(entradaEvento);
        setMensaje(r.mensaje);
        setFase("ok");
      } else if (codigo) {
        setInvitacion(await validarInvitacion(codigo));
        setFase("invitacion");
      } else {
        // QR personal del cliente: visita al Paseo (suma sus monedas de visita).
        const r = await registrarVisitaPaseo(texto.trim());
        setMensaje(`${r.cliente_nombre}: ${r.mensaje}`);
        setFase("ok");
      }
    } catch (err) {
      setMensaje(err.message);
      setFase("error");
    } finally {
      ocupado.current = false;
    }
  }, []);

  const registrar = async () => {
    setFase("cargando");
    try {
      const r = await registrarIngresoOficina(invitacion.codigo);
      setMensaje(r.mensaje);
      setFase("ok");
    } catch (err) {
      setMensaje(err.message);
      setFase("error");
    }
  };

  const salir = () =>
    Platform.OS === "web"
      ? cerrarSesion()
      : Alert.alert("Cerrar sesión", "¿Salir de la portería?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Salir", style: "destructive", onPress: cerrarSesion },
        ]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.marca}>PASEO ARANJUEZ</Text>
          <Text style={styles.titulo}>Portería</Text>
          <Text style={styles.sub}>{user?.first_name || user?.email}</Text>
        </View>
        <TouchableOpacity onPress={salir} style={styles.salir} accessibilityLabel="Cerrar sesión">
          <Ionicons name="log-out-outline" size={22} color={STITCH.white} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.pestanas}>
        {[["escanear", "Escanear", "scan"], ["eventos", "Eventos", "calendar"], ["cartelera", "Cartelera", "film"]].map(([id, texto, icono]) => (
          <TouchableOpacity key={id} onPress={() => setPestana(id)} style={[styles.pestana, pestana === id && styles.pestanaActiva]}>
            <Ionicons name={icono} size={16} color={pestana === id ? STITCH.primary : STITCH.white} />
            <Text style={[styles.pestanaTexto, pestana === id && styles.pestanaTextoActiva]}>{texto}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pestana === "escanear" ? (
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {fase === "camara" ? (
            <>
              <Text style={styles.ayuda}>Escanea el QR de la invitación a una oficina, la entrada a un evento o el QR personal del cliente.</Text>
              <View style={styles.visor}>
                {permiso?.granted ? (
                  <CameraView style={StyleSheet.absoluteFill} facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => procesar(data)} />
                ) : (
                  <TouchableOpacity style={styles.botonClaro} onPress={pedirPermiso}>
                    <Text style={styles.botonClaroTexto}>Permitir cámara</Text>
                  </TouchableOpacity>
                )}
                <View pointerEvents="none" style={styles.marco} />
              </View>
              <Text style={styles.manualTitulo}>O escribe el código de la invitación</Text>
              <View style={styles.manualFila}>
                <TextInput style={styles.input} value={manual} onChangeText={setManual} autoCapitalize="characters"
                  placeholder="Ej. K7QM2XPA" placeholderTextColor="#9fb3c2" onSubmitEditing={() => procesar(manual)} />
                <TouchableOpacity style={styles.botonChico} onPress={() => procesar(manual)} accessibilityLabel="Validar código">
                  <Ionicons name="arrow-forward" size={20} color={STITCH.primary} />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {fase === "cargando" ? <ActivityIndicator size="large" color={STITCH.oro} style={{ marginTop: 80 }} /> : null}

          {fase === "invitacion" && invitacion ? (
            <View style={styles.tarjeta}>
              <View style={styles.validaFila}>
                <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                <Text style={styles.valida}>Invitación válida para hoy</Text>
              </View>
              <Text style={styles.visitante}>{invitacion.visitante_nombre}</Text>
              {invitacion.visitante_ci ? <Text style={styles.dato}>CI: {invitacion.visitante_ci}</Text> : null}
              <View style={styles.separador} />
              <Text style={styles.datoTitulo}>Va a</Text>
              <Text style={styles.oficina}>{invitacion.oficina_nombre}</Text>
              <Text style={styles.dato}>Piso {invitacion.oficina_piso || "—"} · Oficina {invitacion.oficina_local || "—"}</Text>
              {invitacion.hora ? <Text style={styles.dato}>Hora: {invitacion.hora.slice(0, 5)}</Text> : null}
              {invitacion.motivo ? <Text style={styles.dato}>Motivo: {invitacion.motivo}</Text> : null}
              <Text style={styles.datoChico}>{invitacion.origen_nombre}{invitacion.tiene_app ? "" : " · sin app (WhatsApp)"}</Text>
              <TouchableOpacity style={styles.botonPrincipal} onPress={registrar}>
                <Ionicons name="enter" size={20} color={STITCH.white} />
                <Text style={styles.botonPrincipalTexto}>Registrar ingreso</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reiniciar}><Text style={styles.enlace}>Cancelar</Text></TouchableOpacity>
            </View>
          ) : null}

          {fase === "ok" || fase === "error" ? (
            <View style={styles.resultado}>
              <Ionicons name={fase === "ok" ? "checkmark-circle" : "close-circle"} size={84}
                color={fase === "ok" ? "#4ade80" : "#f87171"} />
              <Text style={styles.resultadoTexto}>{mensaje}</Text>
              <TouchableOpacity style={styles.botonClaro} onPress={reiniciar}>
                <Text style={styles.botonClaroTexto}>Escanear siguiente</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido} keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refrescando} tintColor={STITCH.white} onRefresh={refrescar} />}>
          {errorCarga ? <Text style={styles.ayuda}>{errorCarga}</Text> : null}
          {!datos && !errorCarga ? <ActivityIndicator size="large" color={STITCH.oro} style={{ marginTop: 60 }} /> : null}

          {pestana === "eventos" && datos ? (
            datos.eventos.length ? datos.eventos.map((e) => {
              const conCupos = e.acceso === "CUPOS";
              return (
                <View key={e.id} style={styles.fila}>
                  {e.imagen ? <Image source={{ uri: e.imagen }} style={styles.miniatura} /> : (
                    <View style={[styles.miniatura, styles.miniaturaVacia]}><Ionicons name="calendar" size={22} color={STITCH.oro} /></View>
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.filaNombre}>{e.titulo}</Text>
                    <Text style={styles.filaDato}>{cuando(e.inicio)}{e.fin ? ` a ${hora(e.fin)}` : ""}</Text>
                    {e.lugar ? <Text style={styles.filaDato} numberOfLines={1}>{e.lugar}</Text> : null}
                  </View>
                  <Text style={[styles.filaEstado, conCupos ? styles.esperado : styles.ingreso]}>
                    {conCupos ? `${e.reservados}/${e.cupos} cupos` : "Libre"}
                  </Text>
                </View>
              );
            }) : <Text style={styles.ayuda}>No hay eventos próximos.</Text>
          ) : null}

          {pestana === "cartelera" && datos ? (
            datos.cartelera.filter((p) => p.funciones.length).length ? datos.cartelera.filter((p) => p.funciones.length).map((p) => (
              <View key={p.id} style={styles.fila}>
                {p.poster ? <Image source={{ uri: p.poster }} style={styles.poster} /> : (
                  <View style={[styles.poster, styles.miniaturaVacia]}><Ionicons name="film" size={22} color={STITCH.oro} /></View>
                )}
                <View style={styles.flex}>
                  <Text style={styles.filaNombre}>{p.titulo}</Text>
                  <Text style={styles.filaDato}>{p.genero} · {p.clasificacion} · {p.duracion_min} min</Text>
                  <Text style={styles.funciones}>{p.funciones.map((f) => cuando(f.inicio)).join("  ·  ")}</Text>
                </View>
              </View>
            )) : <Text style={styles.ayuda}>No hay películas en cartelera.</Text>
          ) : null}
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.primary },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  marca: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 11, letterSpacing: 1 },
  titulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 26 },
  sub: { color: "#9fb3c2", fontFamily: FUENTES.texto, fontSize: 13 },
  salir: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22, padding: 10 },
  pestanas: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  pestana: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10,
    borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)" },
  pestanaActiva: { backgroundColor: STITCH.secondaryContainer },
  pestanaTexto: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  pestanaTextoActiva: { color: STITCH.primary },
  contenido: { padding: 20, paddingTop: 8, gap: 10, flexGrow: 1 },
  ayuda: { color: "#c9d6e0", fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center", marginVertical: 10 },
  visor: { aspectRatio: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#0B2536", alignItems: "center", justifyContent: "center" },
  marco: { position: "absolute", width: "70%", height: "70%", borderRadius: 20, borderWidth: 3, borderColor: STITCH.oro },
  manualTitulo: { color: "#9fb3c2", fontFamily: FUENTES.textoMedio, fontSize: 12.5, marginTop: 14 },
  manualFila: { flexDirection: "row", gap: 8 },
  input: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.1)",
    color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 16, letterSpacing: 2 },
  botonChico: { width: 48, height: 48, borderRadius: 12, backgroundColor: STITCH.secondaryContainer, alignItems: "center", justifyContent: "center" },
  tarjeta: { backgroundColor: STITCH.white, borderRadius: 20, padding: 20, ...SOMBRA },
  validaFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  valida: { color: "#166534", fontFamily: FUENTES.tituloBold, fontSize: 15 },
  visitante: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 26, marginTop: 12 },
  separador: { height: 1, backgroundColor: STITCH.surfaceContainer, marginVertical: 12 },
  datoTitulo: { color: STITCH.outline, fontFamily: FUENTES.textoFuerte, fontSize: 12 },
  oficina: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 19 },
  dato: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 14.5, marginTop: 3 },
  datoChico: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12, marginTop: 8 },
  botonPrincipal: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#16a34a",
    borderRadius: 999, paddingVertical: 15, marginTop: 18 },
  botonPrincipalTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 16 },
  enlace: { color: STITCH.outline, fontFamily: FUENTES.textoFuerte, textAlign: "center", marginTop: 12 },
  resultado: { alignItems: "center", gap: 12, marginTop: 50 },
  resultadoTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 18, textAlign: "center" },
  botonClaro: { backgroundColor: STITCH.secondaryContainer, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, marginTop: 8 },
  botonClaroTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 },
  filaNombre: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  filaDato: { color: "#9fb3c2", fontFamily: FUENTES.texto, fontSize: 13 },
  filaEstado: { fontFamily: FUENTES.textoFuerte, fontSize: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  miniatura: { width: 54, height: 54, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  miniaturaVacia: { alignItems: "center", justifyContent: "center" },
  poster: { width: 48, height: 72, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  funciones: { color: STITCH.secondaryContainer, fontFamily: FUENTES.textoFuerte, fontSize: 12.5, marginTop: 4 },
  esperado: { backgroundColor: "#FFF4CC", color: "#8A5A00" },
  ingreso: { backgroundColor: "#DCFCE7", color: "#166534" },
});
