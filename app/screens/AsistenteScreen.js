import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import QRCode from "react-native-qrcode-svg";
import ModoVoz from "../components/ModoVoz";
import { PagoQRModal } from "../components/PedidoComer";
import TarjetaAccion from "../components/TarjetaAccion";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";
import {
  archivarConversacion, chatAgente, confirmarAccion, enviarNotaDeVoz,
  listarAccionesConversacion, listarConversaciones, listarMensajesConversacion, rechazarAccion,
} from "../services/agenteService";
import { getPedido } from "../services/pedidosService";
import { detenerVoz, hablarComoJarvis } from "../services/vozJarvis";

const DURACION_MINIMA_MS = 700;
const OPCIONES_GRABACION = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const emocionDe = (texto) => texto?.match(/\[([a-zA-Z ]{2,30})\]/)?.[1]?.trim().toLowerCase() ?? null;
const nivelDeVoz = (db) => (typeof db === "number" ? Math.min(1, Math.max(0, (db + 50) / 50)) : 0);

const mapearMensaje = (item) => ({
  id: `mensaje-${item.id}`,
  rol: item.rol === "USUARIO" ? "usuario" : "jarvis",
  texto: item.contenido,
  esVoz: item.origen === "VOZ",
  productos: item.productos || [],
  empresas: item.empresas || [],
});
const mapearAccionPendiente = (item) => ({
  ...item,
  tipo: item.tipo_accion,
  resumen: item.payload?.resumen || "Acción propuesta por Jarvis",
  detalle: item.payload?.detalle || null,
  estado: "pendiente",
});
const ordenarConversaciones = (items) => [...items].sort(
  (a, b) => new Date(b.actualizada_en).getTime() - new Date(a.actualizada_en).getTime()
);
const formatoDuracion = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function AsistenteScreen({ navigation, route }) {
  const { user } = useUserContext();
  const nombre = user?.first_name || user?.username || "";
  const [conversaciones, setConversaciones] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [esBorradorNuevo, setEsBorradorNuevo] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [accionesPendientes, setAccionesPendientes] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [enviandoTexto, setEnviandoTexto] = useState(false);
  const [enviandoVoz, setEnviandoVoz] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [errorChat, setErrorChat] = useState(null);
  const [errorAcciones, setErrorAcciones] = useState(null);
  const [errorConversaciones, setErrorConversaciones] = useState(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [opcionesConversacion, setOpcionesConversacion] = useState(null);
  const [eliminandoConversationId, setEliminandoConversationId] = useState(null);
  const [modoVoz, setModoVoz] = useState(() => Boolean(route?.params?.modoVoz));
  const [hablando, setHablando] = useState(false);
  const [emocion, setEmocion] = useState(null);
  const [pagoPedido, setPagoPedido] = useState(null);
  const [resultadoConfirmacion, setResultadoConfirmacion] = useState(null);
  const lista = useRef(null);
  const quiereGrabar = useRef(false);
  const conversacionActivaRef = useRef(null);
  const esBorradorNuevoRef = useRef(false);
  const generacionCargaRef = useRef(0);
  const generacionListaRef = useRef(0);
  const preguntaInicial = useRef(null);
  const solicitudInicioProcesadaRef = useRef(null);

  const recorder = useAudioRecorder(OPCIONES_GRABACION);
  const grabacion = useAudioRecorderState(recorder, 100);
  const ocupado = enviandoTexto || enviandoVoz || procesandoAccion;

  const agregarError = useCallback((textoError) => setErrorChat(textoError), []);
  const quitarConversacion = useCallback((id) => {
    generacionListaRef.current += 1;
    setCargandoConversaciones(false);
    setConversaciones((prev) => prev.filter((item) => item.id !== id));
    if (conversacionActivaRef.current === id) {
      generacionCargaRef.current += 1;
      conversacionActivaRef.current = null;
      esBorradorNuevoRef.current = false;
      setEsBorradorNuevo(false);
      setCargandoHistorial(false);
      setMensajes([]);
      setAccionesPendientes([]);
      setHistorialCargado(false);
      setErrorAcciones(null);
    }
    setConversationId((actual) => (actual === id ? null : actual));
  }, []);

  const reconciliarHistorial = useCallback((historial, respuesta) => {
    setMensajes((anteriores) => {
      const porId = new Map(anteriores.map((item) => [item.id, item]));
      const siguiente = historial.map((item) => {
        const nuevo = mapearMensaje(item);
        const anterior = porId.get(nuevo.id);
        return anterior ? { ...nuevo, empresas: anterior.empresas, productos: anterior.productos } : nuevo;
      });
      if (respuesta?.text) {
        for (let i = siguiente.length - 1; i >= 0; i -= 1) {
          if (siguiente[i].rol === "jarvis" && siguiente[i].texto === respuesta.text) {
            siguiente[i] = {
              ...siguiente[i], voz: respuesta.voz || respuesta.text,
              empresas: respuesta.empresas || siguiente[i].empresas || [],
              productos: respuesta.productos || siguiente[i].productos || [],
            };
            break;
          }
        }
      }
      return siguiente;
    });
  }, []);

  const cargarAcciones = useCallback(async (id, generacion) => {
    if (!id) return;
    setErrorAcciones(null);
    try {
      const acciones = await listarAccionesConversacion(id);
      if (generacion !== generacionCargaRef.current || conversacionActivaRef.current !== id) return;
      setAccionesPendientes(acciones
        .filter((accion) => accion.conversation_id === id && accion.estado === "PENDIENTE")
        .map(mapearAccionPendiente));
    } catch (err) {
      if (generacion !== generacionCargaRef.current || conversacionActivaRef.current !== id) return;
      if (err.status === 404) {
        quitarConversacion(id);
        agregarError("Esta conversación ya no está disponible.");
      } else {
        setErrorAcciones(err.message);
      }
    }
  }, [agregarError, quitarConversacion]);

  const cargarHistorial = useCallback(async (id, respuesta) => {
    if (!id) return;
    const generacion = ++generacionCargaRef.current;
    setCargandoHistorial(true);
    setHistorialCargado(false);
    setErrorChat(null);
    try {
      const historial = await listarMensajesConversacion(id);
      if (generacion !== generacionCargaRef.current || conversacionActivaRef.current !== id) return;
      reconciliarHistorial(historial, respuesta);
      setHistorialCargado(true);
      await cargarAcciones(id, generacion);
    } catch (err) {
      if (generacion !== generacionCargaRef.current || conversacionActivaRef.current !== id) return;
      if (err.status === 404) {
        quitarConversacion(id);
        agregarError("Esta conversación ya no está disponible.");
      } else {
        agregarError(err.message);
      }
    } finally {
      if (generacion === generacionCargaRef.current && conversacionActivaRef.current === id) {
        setCargandoHistorial(false);
      }
    }
  }, [agregarError, cargarAcciones, quitarConversacion, reconciliarHistorial]);

  const refrescarConversaciones = useCallback(async () => {
    const generacion = ++generacionListaRef.current;
    setCargandoConversaciones(true);
    try {
      const data = await listarConversaciones();
      if (generacion !== generacionListaRef.current) return;
      const ordenadas = ordenarConversaciones(data);
      setConversaciones(ordenadas);
      const activa = conversacionActivaRef.current;
      if (activa && !ordenadas.some((conversacion) => conversacion.id === activa)) {
        generacionCargaRef.current += 1;
        conversacionActivaRef.current = null;
        esBorradorNuevoRef.current = false;
        setEsBorradorNuevo(false);
        setConversationId(null);
        setCargandoHistorial(false);
        setMensajes([]);
        setAccionesPendientes([]);
        setHistorialCargado(false);
        setErrorAcciones(null);
      }
      if (!conversacionActivaRef.current && !esBorradorNuevoRef.current && ordenadas[0]?.id) {
        const masReciente = ordenadas[0].id;
        conversacionActivaRef.current = masReciente;
        setConversationId(masReciente);
        cargarHistorial(masReciente);
      }
    } catch (err) {
      if (generacion !== generacionListaRef.current) return;
      agregarError(err.message);
    } finally {
      if (generacion === generacionListaRef.current) setCargandoConversaciones(false);
    }
  }, [agregarError, cargarHistorial]);

  useFocusEffect(useCallback(() => { refrescarConversaciones(); }, [refrescarConversaciones]));
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return detenerVoz;
  }, []);

  const crearNuevoChat = useCallback((permitirOcupado = false) => {
    if (ocupado && !permitirOcupado) return;
    setErrorChat(null);
    generacionCargaRef.current += 1;
    conversacionActivaRef.current = null;
    esBorradorNuevoRef.current = true;
    setCargandoHistorial(false);
    setConversationId(null);
    setEsBorradorNuevo(true);
    setMensajes([]);
    setAccionesPendientes([]);
    setHistorialCargado(true);
    setErrorAcciones(null);
    setPanelAbierto(false);
  }, [ocupado]);

  const eliminarConversacionDesdeLista = useCallback((id) => {
    if (eliminandoConversationId) return;
    setOpcionesConversacion(null);
    Alert.alert("Eliminar conversación", "¿Eliminar esta conversación? Ya no aparecerá en tu lista.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar conversación", style: "destructive", onPress: async () => {
        setEliminandoConversationId(id);
        setErrorConversaciones(null);
        try {
          await archivarConversacion(id);
          const eraActiva = conversacionActivaRef.current === id;
          quitarConversacion(id);
          if (eraActiva) crearNuevoChat(true);
          refrescarConversaciones();
        } catch (err) {
          const mensajeError = err.message || "No pudimos eliminar la conversación. Intenta de nuevo.";
          setErrorConversaciones(mensajeError);
          agregarError(mensajeError);
        } finally {
          setEliminandoConversationId(null);
        }
      } },
    ]);
  }, [agregarError, crearNuevoChat, eliminandoConversationId, quitarConversacion, refrescarConversaciones]);
  useEffect(() => {
    const solicitudId = route?.params?.solicitudId;
    if (!route?.params?.iniciarBorrador || !solicitudId || solicitudInicioProcesadaRef.current === solicitudId) return;
    solicitudInicioProcesadaRef.current = solicitudId;
    preguntaInicial.current = route?.params?.pregunta?.trim() || null;
    crearNuevoChat(true);
    setModoVoz(Boolean(route?.params?.modoVoz));
    refrescarConversaciones();
    navigation.setParams({ iniciarBorrador: undefined, solicitudId: undefined, pregunta: undefined, modoVoz: undefined });
  }, [crearNuevoChat, navigation, refrescarConversaciones, route?.params?.iniciarBorrador, route?.params?.modoVoz, route?.params?.pregunta, route?.params?.solicitudId]);

  const seleccionarConversacion = useCallback(async (id) => {
    if (ocupado || id === conversationId) { setPanelAbierto(false); return; }
    generacionCargaRef.current += 1;
    conversacionActivaRef.current = id;
    esBorradorNuevoRef.current = false;
    setConversationId(id);
    setEsBorradorNuevo(false);
    setMensajes([]);
    setAccionesPendientes([]);
    setHistorialCargado(false);
    setPanelAbierto(false);
    await cargarHistorial(id);
  }, [cargarHistorial, conversationId, ocupado]);

  const hablar = useCallback((respuesta) => {
    if (!respuesta) return;
    setEmocion(emocionDe(respuesta));
    hablarComoJarvis(respuesta, { onInicio: () => setHablando(true), onFin: () => setHablando(false) });
  }, []);

  const enviarTexto = useCallback(async (contenido = texto.trim()) => {
    if (!contenido || ocupado) return;
    setTexto("");
    setEnviandoTexto(true);
    setErrorChat(null);
    const id = conversationId;
    try {
      const respuesta = await chatAgente(contenido, id);
      const idRespuesta = respuesta.conversation_id || id;
      generacionCargaRef.current += 1;
      conversacionActivaRef.current = idRespuesta;
      esBorradorNuevoRef.current = false;
      setConversationId(idRespuesta);
      setEsBorradorNuevo(false);
      await cargarHistorial(idRespuesta, respuesta);
      refrescarConversaciones();
    } catch (err) {
      if (err.status === 404 && id) {
        quitarConversacion(id);
        agregarError("Esta conversación ya no está disponible.");
      } else agregarError(err.message);
    } finally {
      setEnviandoTexto(false);
    }
  }, [agregarError, cargarHistorial, conversationId, ocupado, quitarConversacion, refrescarConversaciones, texto]);

  useEffect(() => {
    if (!preguntaInicial.current || !esBorradorNuevoRef.current) return;
    const pregunta = preguntaInicial.current;
    preguntaInicial.current = null;
    enviarTexto(pregunta);
  }, [cargandoConversaciones, enviarTexto]);

  const enviarVoz = useCallback(async (uri) => {
    if (ocupado) return;
    setEnviandoVoz(true);
    setErrorChat(null);
    const id = conversationId;
    try {
      const respuesta = await enviarNotaDeVoz(uri, id);
      const idRespuesta = respuesta.conversation_id || id;
      generacionCargaRef.current += 1;
      conversacionActivaRef.current = idRespuesta;
      esBorradorNuevoRef.current = false;
      setConversationId(idRespuesta);
      setEsBorradorNuevo(false);
      await cargarHistorial(idRespuesta, respuesta);
      if (respuesta.transcripcion) hablar(respuesta.voz || respuesta.text);
      refrescarConversaciones();
    } catch (err) {
      if (err.status === 404 && id) {
        quitarConversacion(id);
        agregarError("Esta conversación ya no está disponible.");
      } else agregarError(err.message);
    } finally {
      setEnviandoVoz(false);
    }
  }, [agregarError, cargarHistorial, conversationId, hablar, ocupado, quitarConversacion, refrescarConversaciones]);

  const empezarGrabacion = useCallback(async () => {
    if (ocupado) return;
    quiereGrabar.current = true;
    detenerVoz();
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) throw new Error("Necesito permiso del micrófono para escucharte. Actívalo en los ajustes.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (quiereGrabar.current) recorder.record();
    } catch (err) {
      quiereGrabar.current = false;
      agregarError(err.message || "No pude usar el micrófono. Intenta de nuevo.");
    }
  }, [agregarError, ocupado, recorder]);

  const terminarGrabacion = useCallback(async () => {
    if (!quiereGrabar.current) return;
    quiereGrabar.current = false;
    if (!recorder.isRecording) return;
    const duracion = recorder.getStatus().durationMillis;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      agregarError("No pude guardar la nota de voz.");
      return;
    }
    if (duracion < DURACION_MINIMA_MS || !recorder.uri) {
      agregarError("No alcancé a escucharte. Habla un poco más.");
      return;
    }
    enviarVoz(recorder.uri);
  }, [agregarError, enviarVoz, recorder]);

  const abrirPago = useCallback(async (id) => {
    try { setPagoPedido(await getPedido(id)); } catch (err) { agregarError(err.message); }
  }, [agregarError]);
  const confirmar = useCallback(async (accion) => {
    if (ocupado) return;
    setProcesandoAccion(true);
    try {
      const data = await confirmarAccion(accion.id);
      await cargarHistorial(conversationId);
      hablar(data.voz || data.text);
      const resultado = data.resultado || {};
      if (resultado.codigo || resultado.qr) {
        setResultadoConfirmacion({ codigo: resultado.codigo, qr: resultado.qr });
      }
      if (resultado.tipo === "pedido") {
        setModoVoz(false);
        await abrirPago(resultado.id);
      }
    } catch (err) {
      if (err.status === 404) {
        quitarConversacion(conversationId);
        agregarError("Esta conversación ya no está disponible.");
      } else agregarError(err.message);
    }
    finally { setProcesandoAccion(false); }
  }, [abrirPago, agregarError, cargarHistorial, conversationId, hablar, ocupado, quitarConversacion]);
  const cancelar = useCallback(async (accion) => {
    if (ocupado) return;
    setProcesandoAccion(true);
    try {
      await rechazarAccion(accion.id);
      await cargarHistorial(conversationId);
    } catch (err) {
      if (err.status === 404) {
        quitarConversacion(conversationId);
        agregarError("Esta conversación ya no está disponible.");
      } else agregarError(err.message);
    } finally { setProcesandoAccion(false); }
  }, [agregarError, cargarHistorial, conversationId, ocupado, quitarConversacion]);

  const grabando = grabacion.isRecording;
  const pensando = ocupado || cargandoHistorial;
  const estadoAvatar = grabando ? "escuchando" : pensando ? "pensando" : hablando ? "hablando" : "inactivo";
  const ultimo = (rol) => [...mensajes].reverse().find((item) => item.rol === rol);
  const bajarALoNuevo = useCallback(() => {
    const ultimoItem = mensajes[mensajes.length - 1];
    if (ultimoItem?.rol === "jarvis" && !accionesPendientes.length
      && (ultimoItem.productos?.length || ultimoItem.empresas?.length)) {
      lista.current?.scrollToIndex({ index: mensajes.length - 1, viewPosition: 0, animated: true });
    } else {
      lista.current?.scrollToEnd({ animated: true });
    }
  }, [accionesPendientes.length, mensajes]);
  const ultimoMensaje = mensajes[mensajes.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver"><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
        <View style={styles.avatar}><Ionicons name="sparkles" size={18} color={COLORS.white} /></View>
        <View style={styles.flex}><Text style={styles.titulo}>Jarvis</Text><Text style={styles.subtitulo}>{pensando ? "Pensando…" : "Asistente del Paseo"}</Text></View>
        <TouchableOpacity onPress={() => setPanelAbierto(true)} style={styles.iconBtn} accessibilityLabel="Ver conversaciones"><Ionicons name="chatbubbles-outline" size={22} color={COLORS.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={crearNuevoChat} disabled={ocupado} style={styles.iconBtn} accessibilityLabel="Nuevo chat"><Ionicons name="add-circle-outline" size={24} color={COLORS.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setModoVoz(true)} style={styles.botonModoVoz} accessibilityLabel="Abrir modo voz con Jarvis"><Ionicons name="pulse" size={18} color={COLORS.white} /><Text style={styles.botonModoVozTexto}>Voz</Text></TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {cargandoConversaciones || cargandoHistorial ? <View style={styles.carga}><ActivityIndicator color={COLORS.primary} /><Text style={styles.textoMuted}>Cargando conversación…</Text></View> : null}
        {!cargandoHistorial && mensajes.length === 0 && (esBorradorNuevo || (!cargandoConversaciones && ((conversationId && historialCargado) || (!conversationId && !errorChat)))) ? <SaludoInicial nombre={nombre} /> : null}
        <FlatList ref={lista} style={styles.flex} data={mensajes} keyExtractor={(item) => item.id} contentContainerStyle={styles.lista} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onContentSizeChange={() => requestAnimationFrame(bajarALoNuevo)} onScrollToIndexFailed={() => lista.current?.scrollToEnd({ animated: true })} renderItem={({ item }) => <Burbuja item={item} onEscuchar={() => hablarComoJarvis(item.voz || item.texto)} onConfirmar={confirmar} onCancelar={cancelar} onPagar={abrirPago} onAbrirEmpresa={(id) => navigation.navigate("Empresa", { id })} onPedirPlato={(producto) => enviarTexto(`Quiero pedir 1 ${producto.nombre} de ${producto.empresa_nombre} para retirar apenas esté listo.`)} />} ListFooterComponent={<><AccionesPendientes acciones={accionesPendientes} error={errorAcciones} onConfirmar={confirmar} onCancelar={cancelar} />{pensando ? <View style={[styles.burbuja, styles.jarvis, styles.pensando]}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.textoMuted}>Jarvis está pensando…</Text></View> : null}</>} />
        {errorChat ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} /><Text style={styles.errorTexto}>{errorChat}</Text></View> : null}
        {resultadoConfirmacion ? <ResultadoConfirmacion resultado={resultadoConfirmacion} onCerrar={() => setResultadoConfirmacion(null)} /> : null}
        {grabando ? <View style={styles.grabando}><View style={styles.puntoRojo} /><Text style={styles.grabandoTexto}>Escuchando… {formatoDuracion(grabacion.durationMillis)} · suelta para enviar</Text></View> : null}
        <View style={styles.barra}><TextInput style={styles.input} value={texto} onChangeText={setTexto} placeholder="Pregúntale a Jarvis…" placeholderTextColor={COLORS.muted} onSubmitEditing={() => enviarTexto()} returnKeyType="send" editable={!grabando && !ocupado} multiline />{texto.trim() ? <TouchableOpacity style={[styles.botonRedondo, ocupado && styles.deshabilitado]} onPress={() => enviarTexto()} disabled={ocupado} accessibilityLabel="Enviar mensaje"><Ionicons name="send" size={20} color={COLORS.white} /></TouchableOpacity> : <Pressable onPressIn={empezarGrabacion} onPressOut={terminarGrabacion} disabled={ocupado} style={[styles.botonRedondo, grabando && styles.botonGrabando, ocupado && styles.deshabilitado]} accessibilityLabel="Mantén presionado para hablar"><Ionicons name="mic" size={22} color={COLORS.white} /></Pressable>}</View>
      </KeyboardAvoidingView>
      <ConversacionesModal visible={panelAbierto} conversaciones={conversaciones} seleccionada={conversationId} cargando={cargandoConversaciones} error={errorConversaciones} opcionesAbiertas={opcionesConversacion} eliminandoId={eliminandoConversationId} onCerrar={() => setPanelAbierto(false)} onSeleccionar={seleccionarConversacion} onNuevo={crearNuevoChat} onOpciones={(id) => setOpcionesConversacion((actual) => (actual === id ? null : id))} onEliminar={eliminarConversacionDesdeLista} />
      <ModoVoz visible={modoVoz} estado={estadoAvatar} nivel={nivelDeVoz(grabacion.metering)} emocion={emocion} tuMensaje={ultimo("usuario")?.texto} respuesta={ultimo("jarvis")?.texto} error={errorChat || (ultimoMensaje?.rol === "error" ? ultimoMensaje.texto : null)} onMicrofono={() => (grabando ? terminarGrabacion() : empezarGrabacion())} onCerrar={() => { if (grabando) { quiereGrabar.current = false; recorder.stop().catch(() => {}); } detenerVoz(); setModoVoz(false); }} accion={accionesPendientes[0]} onConfirmar={confirmar} onCancelar={cancelar} />
      {pagoPedido ? <PagoQRModal pedido={pagoPedido} onCerrar={() => setPagoPedido(null)} /> : null}
    </SafeAreaView>
  );
}

function SaludoInicial({ nombre }) {
  return <View style={[styles.burbuja, styles.jarvis, styles.saludoInicial]}>
    <Text style={styles.textoJarvis}>Hola{nombre ? `, ${nombre}` : ""}. Soy Jarvis. Escríbeme o mantén presionado el micrófono para hablarme.</Text>
  </View>;
}

function ConversacionesModal({ visible, conversaciones, seleccionada, cargando, error, opcionesAbiertas, eliminandoId, onCerrar, onSeleccionar, onNuevo, onOpciones, onEliminar }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}><SafeAreaView style={styles.safe}><View style={styles.modalHeader}><Text style={styles.modalTitulo}>Conversaciones</Text><TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar conversaciones"><Ionicons name="close" size={26} color={COLORS.text} /></TouchableOpacity></View><TouchableOpacity style={styles.nuevoChat} onPress={onNuevo} accessibilityLabel="Crear nuevo chat"><Ionicons name="add" size={20} color={COLORS.white} /><Text style={styles.nuevoChatTexto}>Nuevo chat</Text></TouchableOpacity>{error ? <View style={styles.errorConversaciones}><Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} /><Text style={styles.errorTexto}>{error}</Text></View> : null}{cargando ? <ActivityIndicator style={styles.modalCarga} color={COLORS.primary} /> : <FlatList data={conversaciones} keyExtractor={(item) => item.id} contentContainerStyle={styles.conversaciones} ListEmptyComponent={<Text style={styles.textoMuted}>Aún no tienes conversaciones activas.</Text>} renderItem={({ item }) => <View><View style={[styles.conversacion, item.id === seleccionada && styles.conversacionActiva]}><TouchableOpacity onPress={() => onSeleccionar(item.id)} style={styles.conversacionContenido} accessibilityLabel={`Abrir ${item.titulo || "Nueva conversación"}`}><Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} /><View style={styles.flex}><Text style={styles.conversacionTitulo} numberOfLines={1}>{item.titulo || "Nueva conversación"}</Text><Text style={styles.textoMuted} numberOfLines={1}>{item.actualizada_en ? new Date(item.actualizada_en).toLocaleDateString() : ""}</Text></View></TouchableOpacity><TouchableOpacity onPress={() => onOpciones(item.id)} disabled={Boolean(eliminandoId)} style={styles.opcionesConversacion} accessibilityLabel={`Opciones de ${item.titulo || "Nueva conversación"}`}><Ionicons name={eliminandoId === item.id ? "hourglass-outline" : "ellipsis-horizontal"} size={20} color={COLORS.muted} /></TouchableOpacity></View>{opcionesAbiertas === item.id ? <View style={styles.menuConversacion}><TouchableOpacity onPress={() => onEliminar(item.id)} disabled={Boolean(eliminandoId)} style={styles.menuEliminar} accessibilityLabel="Eliminar conversación"><Ionicons name="trash-outline" size={17} color={COLORS.danger} /><Text style={styles.menuEliminarTexto}>Eliminar conversación</Text></TouchableOpacity></View> : null}</View>} />}</SafeAreaView></Modal>;
}

function AccionesPendientes({ acciones, error, onConfirmar, onCancelar }) {
  if (!acciones.length && !error) return null;
  return <View style={styles.accionesPendientes}>
    <View style={styles.accionesTitulo}><Ionicons name="time-outline" size={18} color={COLORS.primary} /><Text style={styles.accionesTituloTexto}>Acciones pendientes</Text></View>
    {error ? <Text style={styles.accionesError}>No pudimos actualizar las acciones: {error}</Text> : null}
    {acciones.map((accion) => <TarjetaAccion key={accion.id} accion={accion} onConfirmar={onConfirmar} onCancelar={onCancelar} />)}
  </View>;
}

function ResultadoConfirmacion({ resultado, onCerrar }) {
  return <View style={styles.resultadoConfirmacion}>
    <View style={styles.resultadoCabecera}>
      <Text style={styles.resultadoTitulo}>Acción confirmada</Text>
      <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar resultado"><Ionicons name="close" size={18} color={COLORS.muted} /></TouchableOpacity>
    </View>
    {resultado.codigo ? <><Text style={styles.codigoEtiqueta}>Tu código</Text><Text style={styles.codigoValor} selectable>{resultado.codigo}</Text></> : null}
    {resultado.qr ? <View style={styles.qr}><QRCode value={resultado.qr} size={140} /></View> : null}
  </View>;
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
    <View style={esUsuario ? styles.filaUsuario : styles.filaJarvis}>
      <View style={[styles.burbuja, esUsuario ? styles.usuario : styles.jarvis]}>
        {item.esVoz ? (
          <View style={styles.etiquetaVoz}>
            <Ionicons name="mic" size={12} color={COLORS.secondary} />
            <Text style={styles.etiquetaVozTexto}>Nota de voz</Text>
          </View>
        ) : null}
        <Text style={esUsuario ? styles.textoUsuario : styles.textoJarvis}>{item.texto}</Text>
        {!esUsuario ? (
          <TouchableOpacity onPress={onEscuchar} style={styles.escuchar} accessibilityLabel="Escuchar respuesta">
            <Ionicons name="play-circle-outline" size={16} color={COLORS.muted} />
            <Text style={styles.textoMuted}>Escuchar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tarjetas debajo del globo, a todo el ancho: se leen sin deslizar hacia el costado. */}
      {item.accion ? <TarjetaAccion accion={item.accion} onConfirmar={onConfirmar} onCancelar={onCancelar} /> : null}
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
          <Text style={styles.pagarTexto}>Ver mi QR de pago</Text>
        </TouchableOpacity>
      ) : null}
      {item.productos?.map((p) => (
        <View key={p.id} style={styles.plato}>
          {p.foto ? <Image source={{ uri: p.foto }} style={styles.platoFoto} /> : (
            <View style={[styles.platoFoto, styles.fichaLogoVacio]}>
              <Ionicons name="restaurant" size={22} color={COLORS.white} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.fichaNombre} numberOfLines={2}>{p.nombre}</Text>
            <Text style={styles.textoMuted} numberOfLines={1}>
              {p.empresa_nombre}{p.piso ? ` · ${p.piso === "PB" ? "PB" : `piso ${p.piso}`}` : ""}
            </Text>
            <Text style={styles.platoPrecio}>
              Bs {Number(p.precio).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <TouchableOpacity style={styles.platoBoton} onPress={() => onPedirPlato(p)}
            accessibilityLabel={`Pedir ${p.nombre}`}>
            <Ionicons name="bag-add" size={15} color={COLORS.white} />
            <Text style={styles.platoBotonTexto}>Pedir</Text>
          </TouchableOpacity>
        </View>
      ))}
      {item.empresas?.length ? (
        <View style={styles.locales}>
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
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filaJarvis: { alignSelf: "stretch", gap: 8 },
  filaUsuario: { alignSelf: "stretch", alignItems: "flex-end" },
  locales: { gap: 6 },
  errorConversaciones: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10 },
  conversacionContenido: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  opcionesConversacion: { padding: 6, marginLeft: 4 },
  menuConversacion: { marginTop: -4, marginBottom: 6, alignItems: "flex-end" },
  menuEliminar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "#FEF2F2" },
  menuEliminarTexto: { color: COLORS.danger, fontSize: 13, fontWeight: "700" },
  saludoInicial: { marginHorizontal: 16, marginTop: 24 },
  resultadoConfirmacion: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#86EFAC", alignItems: "center" },
  resultadoCabecera: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  resultadoTitulo: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  safe: { flex: 1, backgroundColor: COLORS.bg }, flex: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }, iconBtn: { padding: 4 }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }, titulo: { fontSize: 17, fontWeight: "800", color: COLORS.text }, subtitulo: { fontSize: 12, color: COLORS.muted }, botonModoVoz: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, botonModoVozTexto: { color: COLORS.white, fontWeight: "700", fontSize: 13 }, archivar: { flexDirection: "row", alignSelf: "flex-end", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingTop: 7 }, archivarTexto: { fontSize: 12, color: COLORS.muted }, lista: { padding: 16, gap: 14, flexGrow: 1 }, accionesPendientes: { marginBottom: 12, backgroundColor: "#FFF8E1", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#F5B301" }, accionesTitulo: { flexDirection: "row", alignItems: "center", gap: 6 }, accionesTituloTexto: { fontSize: 15, fontWeight: "800", color: COLORS.text }, accionesError: { marginTop: 6, color: COLORS.danger, fontSize: 12 }, burbuja: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 }, jarvis: { alignSelf: "flex-start", backgroundColor: COLORS.white, borderWidth: 1, borderColor: "#E2E8F0", borderBottomLeftRadius: 4 }, usuario: { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderBottomRightRadius: 4 }, textoJarvis: { fontSize: 15, color: COLORS.text, lineHeight: 21 }, textoUsuario: { fontSize: 15, color: COLORS.white, lineHeight: 21 }, textoMuted: { fontSize: 12, color: COLORS.muted }, pensando: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }, carga: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 8 }, vacio: { alignItems: "center", gap: 8, padding: 28 }, vacioTitulo: { fontSize: 16, fontWeight: "800", color: COLORS.text }, etiquetaVoz: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }, etiquetaVozTexto: { fontSize: 11, color: COLORS.secondary, fontWeight: "700" }, escuchar: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }, error: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "90%" }, errorTexto: { flexShrink: 1, fontSize: 13, color: COLORS.danger }, grabando: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 8, backgroundColor: "#FEF2F2" }, puntoRojo: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger }, grabandoTexto: { fontSize: 13, color: COLORS.danger, fontWeight: "600" }, barra: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: "#E2E8F0" }, input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: COLORS.bg, borderRadius: 23, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: COLORS.text }, botonRedondo: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }, botonGrabando: { backgroundColor: COLORS.danger, transform: [{ scale: 1.15 }] }, deshabilitado: { opacity: 0.5 }, codigo: { backgroundColor: COLORS.white, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" }, codigoEtiqueta: { fontSize: 11, color: COLORS.muted, fontWeight: "700" }, codigoValor: { fontSize: 24, fontWeight: "800", letterSpacing: 4, color: COLORS.primary }, qr: { marginTop: 8, padding: 8, backgroundColor: "#fff", borderRadius: 10 }, pagar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 10 }, pagarTexto: { color: COLORS.white, fontWeight: "700", fontSize: 14 }, plato: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: "#E2E8F0" }, platoFoto: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#E2E8F0" }, platoPrecio: { fontSize: 15, fontWeight: "800", color: COLORS.primary, marginTop: 2 }, platoBoton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, platoBotonTexto: { color: COLORS.white, fontWeight: "700", fontSize: 13 }, ficha: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#E2E8F0" }, fichaLogo: { width: 36, height: 36, borderRadius: 10 }, fichaLogoVacio: { backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }, fichaLetra: { color: COLORS.white, fontWeight: "800" }, fichaTexto: { flex: 1 }, fichaNombre: { fontSize: 14, fontWeight: "700", color: COLORS.text }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, backgroundColor: COLORS.white }, modalTitulo: { fontSize: 20, fontWeight: "800", color: COLORS.text }, nuevoChat: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, margin: 16, padding: 12, backgroundColor: COLORS.primary, borderRadius: 12 }, nuevoChatTexto: { color: COLORS.white, fontWeight: "800" }, conversaciones: { padding: 16, gap: 8 }, conversacion: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" }, conversacionActiva: { borderColor: COLORS.primary, backgroundColor: "#EFF6FF" }, conversacionTitulo: { color: COLORS.text, fontWeight: "700" }, modalCarga: { marginTop: 32 },
});
