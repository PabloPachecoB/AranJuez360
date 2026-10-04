import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import QRCode from "react-native-qrcode-svg";
import ModoVoz from "../components/ModoVoz";
import { PagoQRModal } from "../components/PedidoComer";
import TarjetaAccion from "../components/TarjetaAccion";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";
import { chatAgente, confirmarAccion, enviarNotaDeVoz, rechazarAccion } from "../services/agenteService";
import { getPedido } from "../services/pedidosService";
import { detenerVoz, hablarComoJarvis } from "../services/vozJarvis";

// Notas más cortas que esto se descartan (toque accidental del micrófono).
const DURACION_MINIMA_MS = 700;
// Con metering el orbe del modo voz reacciona al volumen de tu voz.
const OPCIONES_GRABACION = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

// Volumen del micrófono en dB (-160..0) → 0..1 para la animación.
// Primera etiqueta de emoción de la respuesta ("[excited] ¡Felicidades!" → "excited").
const emocionDe = (texto) => texto?.match(/\[([a-zA-Z ]{2,30})\]/)?.[1]?.trim().toLowerCase() ?? null;

const nivelDeVoz = (db) => (typeof db === "number" ? Math.min(1, Math.max(0, (db + 50) / 50)) : 0);

let siguienteId = 0;
const mensaje = (rol, texto, extra = {}) => ({ id: String(siguienteId++), rol, texto, ...extra });

function formatoDuracion(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function AsistenteScreen({ navigation, route }) {
  const { user } = useUserContext();
  const nombre = user?.first_name || user?.username || "";
  // Un hilo nuevo por visita: la conversación en pantalla y la del backend coinciden.
  const [threadId] = useState(() => `app-${user?.id ?? "anon"}-${Date.now()}`);
  const [mensajes, setMensajes] = useState(() => [
    mensaje("jarvis", `Hola${nombre ? `, ${nombre}` : ""}. Soy Jarvis. Escríbeme o mantén presionado el micrófono para hablarme.`),
  ]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  // Desde el Inicio se puede abrir directo en modo voz o con una pregunta lista.
  const [modoVoz, setModoVoz] = useState(() => Boolean(route?.params?.modoVoz));
  const [hablando, setHablando] = useState(false);
  const [emocion, setEmocion] = useState(null);
  const [pagoPedido, setPagoPedido] = useState(null); // pedido de comida que Jarvis creó y falta pagar
  const lista = useRef(null);

  const recorder = useAudioRecorder(OPCIONES_GRABACION);
  const grabacion = useAudioRecorderState(recorder, 100);
  // El usuario puede soltar el botón mientras aún se pide el permiso o se prepara el grabador.
  const quiereGrabar = useRef(false);

  useEffect(() => {
    // iOS: que Jarvis se escuche aunque el teléfono esté en modo silencio.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return detenerVoz;
  }, []);

  const agregar = useCallback((m) => setMensajes((prev) => [...prev, m]), []);

  const hablar = useCallback((respuesta) => {
    if (!respuesta) return;
    setEmocion(emocionDe(respuesta));
    hablarComoJarvis(respuesta, { onInicio: () => setHablando(true), onFin: () => setHablando(false) });
  }, []);

  const procesar = useCallback(
    async (peticion) => {
      setPensando(true);
      try {
        const data = await peticion();
        if (data.transcripcion) {
          agregar(mensaje("usuario", data.transcripcion, { esVoz: true }));
        }
        const respuesta = data.text || "No tengo una respuesta para eso.";
        // `voz` trae etiquetas de emoción ([excited], [warmly]…) para la voz de Jarvis.
        const conEmocion = data.voz || respuesta;
        // `accion`: Jarvis propuso reservar/canjear/cancelar; se ejecuta solo si el usuario confirma.
        agregar(mensaje("jarvis", respuesta, {
          voz: conEmocion,
          accion: data.accion ? { ...data.accion, estado: "pendiente" } : null,
          empresas: data.empresas || [],
          productos: data.productos || [], // platos que Jarvis nombró, con foto
        }));
        // Solo responde en voz alta si le hablaste (nota de voz o modo voz), no al escribir.
        if (data.transcripcion) hablar(conEmocion);
      } catch (err) {
        agregar(mensaje("error", err.message));
      } finally {
        setPensando(false);
      }
    },
    [agregar, hablar]
  );

  const marcarAccion = useCallback((id, estado) => {
    setMensajes((prev) => prev.map((m) => (m.accion?.id === id ? { ...m, accion: { ...m.accion, estado } } : m)));
  }, []);

  const confirmar = useCallback(async (accion) => {
    marcarAccion(accion.id, "procesando");
    setPensando(true);
    try {
      const data = await confirmarAccion(accion.id);
      marcarAccion(accion.id, "confirmada");
      const resultado = data.resultado || {};
      agregar(mensaje("jarvis", data.text, {
        voz: data.voz,
        codigo: resultado.codigo,
        qr: resultado.qr, // entrada a un evento con cupos
        pedidoId: resultado.tipo === "pedido" ? resultado.id : null,
      }));
      hablar(data.voz || data.text);
      // Pedido de comida: se abre el cobro con QR en el mismo chat.
      if (resultado.tipo === "pedido") abrirPago(resultado.id);
    } catch (err) {
      marcarAccion(accion.id, "fallida");
      agregar(mensaje("error", err.message));
    } finally {
      setPensando(false);
    }
  }, [agregar, hablar, marcarAccion]);

  const abrirPago = useCallback(async (id) => {
    try {
      setPagoPedido(await getPedido(id));
    } catch (err) {
      agregar(mensaje("error", err.message));
    }
  }, [agregar]);

  const cancelar = useCallback(async (accion) => {
    marcarAccion(accion.id, "cancelada");
    try {
      await rechazarAccion(accion.id);
    } catch {
      // Si falla, la propuesta vence sola en el servidor.
    }
    agregar(mensaje("jarvis", "Listo, no hice nada. ¿Te ayudo con otra cosa?"));
  }, [agregar, marcarAccion]);

  const preguntaInicial = useRef(route?.params?.pregunta?.trim() || null);
  useEffect(() => {
    const pregunta = preguntaInicial.current;
    if (!pregunta) return;
    preguntaInicial.current = null;
    agregar(mensaje("usuario", pregunta));
    procesar(() => chatAgente(pregunta, threadId));
  }, [agregar, procesar, threadId]);

  const enviarTexto = useCallback(() => {
    const limpio = texto.trim();
    if (!limpio || pensando) return;
    setTexto("");
    agregar(mensaje("usuario", limpio));
    procesar(() => chatAgente(limpio, threadId));
  }, [texto, pensando, agregar, procesar, threadId]);

  const empezarGrabacion = useCallback(async () => {
    if (pensando) return;
    quiereGrabar.current = true;
    detenerVoz();
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        quiereGrabar.current = false;
        agregar(mensaje("error", "Necesito permiso del micrófono para escucharte. Actívalo en los ajustes."));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!quiereGrabar.current) return; // ya soltó el botón
      recorder.record();
    } catch {
      quiereGrabar.current = false;
      agregar(mensaje("error", "No pude usar el micrófono. Intenta de nuevo."));
    }
  }, [pensando, recorder, agregar]);

  const terminarGrabacion = useCallback(async () => {
    if (!quiereGrabar.current) return;
    quiereGrabar.current = false;
    if (!recorder.isRecording) return;
    const duracion = recorder.getStatus().durationMillis;
    try {
      await recorder.stop();
      // Sin esto, iOS deja el audio por el auricular y la voz de Jarvis suena muy bajo.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      agregar(mensaje("error", "No pude guardar la nota de voz."));
      return;
    }
    if (duracion < DURACION_MINIMA_MS || !recorder.uri) {
      agregar(mensaje("error", "No alcancé a escucharte. Habla un poco más."));
      return;
    }
    const uri = recorder.uri;
    procesar(() => enviarNotaDeVoz(uri, threadId));
  }, [recorder, agregar, procesar, threadId]);

  const grabando = grabacion.isRecording;

  // Modo voz: un toque empieza a escuchar, otro toque envía; mientras habla, interrumpe y escucha.
  const tocarMicrofonoModoVoz = () => {
    if (grabando) terminarGrabacion();
    else empezarGrabacion();
  };

  const cerrarModoVoz = () => {
    if (grabando) {
      quiereGrabar.current = false;
      recorder.stop().catch(() => {});
    }
    detenerVoz();
    setModoVoz(false);
  };

  const estadoAvatar = grabando ? "escuchando" : pensando ? "pensando" : hablando ? "hablando" : "inactivo";
  const ultimo = (rol) => [...mensajes].reverse().find((m) => m.rol === rol);
  const ultimoMensaje = mensajes[mensajes.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={18} color={COLORS.white} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Jarvis</Text>
          <Text style={styles.subtitulo}>{pensando ? "Pensando…" : "Asistente del Paseo"}</Text>
        </View>
        <TouchableOpacity onPress={() => setModoVoz(true)} style={styles.botonModoVoz}
          accessibilityLabel="Abrir modo voz con Jarvis">
          <Ionicons name="pulse" size={18} color={COLORS.white} />
          <Text style={styles.botonModoVozTexto}>Voz</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={lista}
          data={mensajes}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.lista}
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <Burbuja item={item} onEscuchar={() => hablarComoJarvis(item.voz || item.texto)}
              onConfirmar={confirmar} onCancelar={cancelar} onPagar={abrirPago}
              onPedirPlato={(p) => {
                if (pensando) return;
                const frase = `Quiero pedir ${p.nombre} de ${p.empresa_nombre}`;
                agregar(mensaje("usuario", frase));
                procesar(() => chatAgente(frase, threadId));
              }}
              onAbrirEmpresa={(id) => navigation.navigate("Empresa", { id })} />
          )}
          ListFooterComponent={pensando ? (
            <View style={[styles.burbuja, styles.jarvis, styles.pensando]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.textoMuted}>Jarvis está pensando…</Text>
            </View>
          ) : null}
        />

        {grabando ? (
          <View style={styles.grabando}>
            <View style={styles.puntoRojo} />
            <Text style={styles.grabandoTexto}>
              Escuchando… {formatoDuracion(grabacion.durationMillis)} · suelta para enviar
            </Text>
          </View>
        ) : null}

        <View style={styles.barra}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Pregúntale a Jarvis…"
            placeholderTextColor={COLORS.muted}
            onSubmitEditing={enviarTexto}
            returnKeyType="send"
            editable={!grabando}
            multiline
          />
          {texto.trim() ? (
            <TouchableOpacity style={styles.botonRedondo} onPress={enviarTexto} disabled={pensando}
              accessibilityLabel="Enviar mensaje">
              <Ionicons name="send" size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <Pressable
              onPressIn={empezarGrabacion}
              onPressOut={terminarGrabacion}
              disabled={pensando}
              style={[styles.botonRedondo, grabando && styles.botonGrabando, pensando && styles.deshabilitado]}
              accessibilityLabel="Mantén presionado para hablar"
            >
              <Ionicons name="mic" size={22} color={COLORS.white} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
      <ModoVoz
        visible={modoVoz}
        estado={estadoAvatar}
        nivel={nivelDeVoz(grabacion.metering)}
        emocion={emocion}
        tuMensaje={ultimo("usuario")?.texto}
        respuesta={ultimo("jarvis")?.texto}
        error={ultimoMensaje?.rol === "error" ? ultimoMensaje.texto : null}
        onMicrofono={tocarMicrofonoModoVoz}
        onCerrar={cerrarModoVoz}
        accion={[...mensajes].reverse().find((m) => m.accion?.estado === "pendiente")?.accion}
        onConfirmar={confirmar}
        onCancelar={cancelar}
      />
      {pagoPedido ? (
        <PagoQRModal pedido={pagoPedido} onCerrar={() => setPagoPedido(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function Burbuja({ item, onEscuchar, onConfirmar, onCancelar, onAbrirEmpresa, onPagar, onPedirPlato }) {
  if (item.rol === "error") {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
        <Text style={styles.errorTexto}>{item.texto}</Text>
      </View>
    );
  }
  const esUsuario = item.rol === "usuario";
  return (
    <View style={[styles.burbuja, esUsuario ? styles.usuario : styles.jarvis]}>
      {item.esVoz ? (
        <View style={styles.etiquetaVoz}>
          <Ionicons name="mic" size={12} color={COLORS.secondary} />
          <Text style={styles.etiquetaVozTexto}>Nota de voz</Text>
        </View>
      ) : null}
      <Text style={esUsuario ? styles.textoUsuario : styles.textoJarvis}>{item.texto}</Text>
      {item.codigo ? (
        <View style={styles.codigo}>
          <Text style={styles.codigoEtiqueta}>Tu código</Text>
          <Text style={styles.codigoValor} selectable>{item.codigo}</Text>
          {item.qr ? <View style={styles.qr}><QRCode value={item.qr} size={140} /></View> : null}
        </View>
      ) : null}
      {item.pedidoId ? (
        <TouchableOpacity style={styles.pagar} onPress={() => onPagar(item.pedidoId)}>
          <Ionicons name="qr-code" size={16} color={COLORS.white} />
          <Text style={styles.pagarTexto}>Pagar / ver mi pedido</Text>
        </TouchableOpacity>
      ) : null}
      {item.accion ? <TarjetaAccion accion={item.accion} onConfirmar={onConfirmar} onCancelar={onCancelar} /> : null}
      {item.productos?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fichas}>
          {item.productos.map((p) => (
            <View key={p.id} style={styles.plato}>
              {p.foto ? <Image source={{ uri: p.foto }} style={styles.platoFoto} /> : (
                <View style={[styles.platoFoto, styles.fichaLogoVacio]}>
                  <Ionicons name="restaurant" size={26} color={COLORS.white} />
                </View>
              )}
              <View style={styles.platoCuerpo}>
                <Text style={styles.fichaNombre} numberOfLines={2}>{p.nombre}</Text>
                <Text style={styles.textoMuted} numberOfLines={1}>
                  {p.empresa_nombre}{p.piso ? ` · ${p.piso === "PB" ? "PB" : `piso ${p.piso}`}` : ""}
                </Text>
                <Text style={styles.platoPrecio}>Bs {Number(p.precio)}</Text>
                <TouchableOpacity style={styles.platoBoton} onPress={() => onPedirPlato(p)}
                  accessibilityLabel={`Pedir ${p.nombre}`}>
                  <Ionicons name="bag-add" size={14} color={COLORS.white} />
                  <Text style={styles.platoBotonTexto}>Pedir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {item.empresas?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fichas}>
          {item.empresas.map((e) => (
            <TouchableOpacity key={e.id} style={styles.ficha} onPress={() => onAbrirEmpresa(e.id)}
              accessibilityLabel={`Ver ${e.nombre}`}>
              {e.logo ? <Image source={{ uri: e.logo }} style={styles.fichaLogo} /> : (
                <View style={[styles.fichaLogo, styles.fichaLogoVacio]}>
                  <Text style={styles.fichaLetra}>{e.nombre.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.fichaTexto}>
                <Text style={styles.fichaNombre} numberOfLines={1}>{e.nombre}</Text>
                <Text style={styles.textoMuted} numberOfLines={1}>
                  {e.piso ? (e.piso === "PB" ? "Planta baja" : `Piso ${e.piso}`) : e.categoria_nombre || "Ver ficha"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {!esUsuario ? (
        <TouchableOpacity onPress={onEscuchar} style={styles.escuchar} accessibilityLabel="Escuchar respuesta">
          <Ionicons name="play-circle-outline" size={16} color={COLORS.muted} />
          <Text style={styles.textoMuted}>Escuchar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  fichas: { gap: 8, paddingTop: 10 },
  plato: { width: 170, backgroundColor: COLORS.white, borderRadius: 14, overflow: "hidden", borderWidth: 1,
    borderColor: "#E2E8F0" },
  platoFoto: { width: "100%", height: 92, backgroundColor: "#E2E8F0" },
  platoCuerpo: { padding: 8, gap: 2 },
  platoPrecio: { fontSize: 15, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  platoBoton: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 7 },
  platoBotonTexto: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  ficha: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.white, borderRadius: 12,
    padding: 8, borderWidth: 1, borderColor: "#E2E8F0", maxWidth: 210 },
  fichaLogo: { width: 40, height: 40, borderRadius: 10 },
  fichaLogoVacio: { backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  fichaLetra: { color: COLORS.white, fontWeight: "800" },
  fichaTexto: { flexShrink: 1 },
  fichaNombre: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  iconBtn: { padding: 4 },
  botonModoVoz: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  botonModoVozTexto: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  subtitulo: { fontSize: 12, color: COLORS.muted },
  lista: { padding: 16, gap: 10 },
  burbuja: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  jarvis: { alignSelf: "flex-start", backgroundColor: COLORS.white, borderWidth: 1, borderColor: "#E2E8F0",
    borderBottomLeftRadius: 4 },
  usuario: { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  textoJarvis: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  textoUsuario: { fontSize: 15, color: COLORS.white, lineHeight: 21 },
  textoMuted: { fontSize: 12, color: COLORS.muted },
  pensando: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  etiquetaVoz: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  etiquetaVozTexto: { fontSize: 11, color: COLORS.secondary, fontWeight: "700" },
  escuchar: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  error: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", backgroundColor: "#FEF2F2",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "90%" },
  errorTexto: { flexShrink: 1, fontSize: 13, color: COLORS.danger },
  grabando: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 8,
    backgroundColor: "#FEF2F2" },
  puntoRojo: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  grabandoTexto: { fontSize: 13, color: COLORS.danger, fontWeight: "600" },
  barra: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: COLORS.bg, borderRadius: 23,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: COLORS.text },
  botonRedondo: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center" },
  botonGrabando: { backgroundColor: COLORS.danger, transform: [{ scale: 1.15 }] },
  deshabilitado: { opacity: 0.5 },
  codigo: { marginTop: 10, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, alignItems: "center" },
  codigoEtiqueta: { fontSize: 11, color: COLORS.muted, fontWeight: "700" },
  codigoValor: { fontSize: 24, fontWeight: "800", letterSpacing: 4, color: COLORS.primary },
  qr: { marginTop: 8, padding: 8, backgroundColor: "#fff", borderRadius: 10 },
  pagar: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 10 },
  pagarTexto: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
