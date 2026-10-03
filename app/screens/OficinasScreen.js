import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import QRCode from "react-native-qrcode-svg";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { cancelarVisita, getMisVisitas, getOficina, getOficinas, solicitarVisita } from "../services/oficinasService";

const PESTANAS = [
  { id: "oficinas", texto: "Oficinas", icono: "business" },
  { id: "solicitar", texto: "Solicitar", icono: "add-circle" },
  { id: "visitas", texto: "Mis visitas", icono: "qr-code" },
];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HORAS = ["09:00", "10:00", "11:00", "12:00", "14:30", "15:30", "16:30", "17:30"];
const COLOR_ESTADO = {
  PENDIENTE: ["#FFF4CC", "#8A5A00"], APROBADA: ["#DCFCE7", "#166534"], USADA: ["#E5E8EE", "#41474d"],
  RECHAZADA: ["#FEE2E2", "#991B1B"], CANCELADA: ["#E5E8EE", "#72787e"],
};

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fechaBonita = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]} ${d}/${m}`;
};
const horario = (h) => (h.cerrado ? "Cerrado" : h.abre ? `${h.abre.slice(0, 5)} – ${h.cierra?.slice(0, 5)}` : "—");

function abrirWhatsapp(numero, oficina) {
  const limpio = (numero || "").replace(/\D/g, "");
  const completo = limpio.length === 8 ? `591${limpio}` : limpio;
  Linking.openURL(`https://wa.me/${completo}?text=${encodeURIComponent(`Hola ${oficina}, les escribo desde la app del Paseo Aranjuez.`)}`)
    .catch(() => Alert.alert("WhatsApp", "No pudimos abrir WhatsApp en este teléfono."));
}

/** Ficha de una oficina: a qué se dedica, ubicación, horario de atención y servicios. */
function DetalleOficina({ id, onCerrar, onSolicitar }) {
  const [oficina, setOficina] = useState(null);
  useEffect(() => {
    getOficina(id).then(setOficina).catch(() => onCerrar());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo recargar si cambia la oficina
  }, [id]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <View style={styles.modal}>
          <TouchableOpacity onPress={onCerrar} style={styles.modalCerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={24} color={STITCH.onSurface} />
          </TouchableOpacity>
          {!oficina ? <ActivityIndicator style={{ margin: 40 }} color={STITCH.primary} /> : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detalleCabecera}>
                <Logo empresa={oficina} grande />
                <View style={styles.flex}>
                  <Text style={styles.detalleTitulo}>{oficina.nombre}</Text>
                  {oficina.lema ? <Text style={styles.lema}>{oficina.lema}</Text> : null}
                  <Text style={styles.meta}>{oficina.categoria_nombre || "Oficina"}</Text>
                </View>
              </View>
              {oficina.descripcion ? <Text style={styles.descripcion}>{oficina.descripcion}</Text> : null}

              <View style={styles.datoFila}>
                <Ionicons name="location" size={18} color={STITCH.secondary} />
                <Text style={styles.dato}>Piso {oficina.piso || "—"} · Oficina {oficina.local || "—"}
                  {oficina.referencia ? `\n${oficina.referencia}` : ""}</Text>
              </View>

              {oficina.horarios?.length ? (
                <>
                  <Text style={styles.subtitulo}>Horario de atención</Text>
                  {oficina.horarios.map((h) => (
                    <View key={h.dia} style={styles.horarioFila}>
                      <Text style={styles.horarioDia}>{h.dia_nombre}</Text>
                      <Text style={[styles.horarioHora, h.cerrado && styles.cerrado]}>{horario(h)}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {oficina.productos?.length ? (
                <>
                  <Text style={styles.subtitulo}>Servicios</Text>
                  {oficina.productos.map((p) => (
                    <View key={p.id} style={styles.servicio}>
                      <Text style={styles.servicioNombre}>{p.nombre}</Text>
                      {Number(p.precio) ? <Text style={styles.servicioPrecio}>desde Bs {Number(p.precio)}</Text> : null}
                    </View>
                  ))}
                </>
              ) : null}

              {oficina.fotos?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotos}>
                  {oficina.fotos.map((f) => <Image key={f.id} source={{ uri: f.imagen }} style={styles.foto} />)}
                </ScrollView>
              ) : null}

              <TouchableOpacity style={styles.botonPrincipal} onPress={() => onSolicitar(oficina)}>
                <Ionicons name="calendar" size={18} color={STITCH.white} />
                <Text style={styles.botonPrincipalTexto}>Solicitar visita</Text>
              </TouchableOpacity>
              {oficina.whatsapp ? (
                <TouchableOpacity style={styles.botonWhatsapp} onPress={() => abrirWhatsapp(oficina.whatsapp, oficina.nombre)}>
                  <Ionicons name="logo-whatsapp" size={18} color="#166534" />
                  <Text style={styles.botonWhatsappTexto}>Escribir por WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Logo({ empresa, grande }) {
  const tam = grande ? styles.logoGrande : styles.logo;
  if (empresa.logo) return <Image source={{ uri: empresa.logo }} style={tam} />;
  return (
    <View style={[tam, styles.logoVacio]}>
      <Text style={[styles.logoLetra, grande && { fontSize: 26 }]}>{empresa.nombre.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export default function OficinasScreen({ navigation, route }) {
  const [pestana, setPestana] = useState(route?.params?.pestana || "oficinas");
  const [oficinas, setOficinas] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [qrAbierto, setQrAbierto] = useState(null);
  // Formulario de solicitud
  const proximosDias = useMemo(() => Array.from({ length: 10 }, (_, i) => isoLocal(new Date(Date.now() + i * 86400000))), []);
  const [form, setForm] = useState({ oficina: null, fecha: proximosDias[0], hora: "10:00", motivo: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setOficinas(await getOficinas());
    } catch {
      setOficinas([]);
    }
    try {
      setVisitas(await getMisVisitas());
    } catch {
      setVisitas([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const irASolicitar = (oficina) => {
    setDetalle(null);
    setForm((f) => ({ ...f, oficina }));
    setError(null);
    setPestana("solicitar");
  };

  const enviar = async () => {
    if (!form.oficina) return setError("Elige la oficina que quieres visitar.");
    setEnviando(true);
    setError(null);
    try {
      await solicitarVisita({ oficina: form.oficina.id, fecha: form.fecha, hora: form.hora, motivo: form.motivo });
      setForm((f) => ({ ...f, motivo: "" }));
      await cargar();
      setPestana("visitas");
      Alert.alert("Solicitud enviada", `${form.oficina.nombre} revisará tu visita. Cuando la aprueben verás tu QR aquí.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = (v) =>
    Alert.alert("Cancelar visita", `¿Cancelar tu visita a ${v.oficina_nombre}?`, [
      { text: "No", style: "cancel" },
      { text: "Sí, cancelar", style: "destructive", onPress: async () => {
        try {
          await cancelarVisita(v.id);
          cargar();
        } catch (err) {
          Alert.alert("No se pudo", err.message);
        }
      } },
    ]);

  const pendientes = visitas.filter((v) => v.estado === "PENDIENTE").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Aranjuez Oficinas</Text>
          <Text style={styles.sub}>Profesionales y servicios dentro del Paseo</Text>
        </View>
      </View>

      <View style={styles.pestanas}>
        {PESTANAS.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setPestana(p.id)}
            style={[styles.pestana, pestana === p.id && styles.pestanaActiva]}>
            <Ionicons name={p.icono} size={16} color={pestana === p.id ? STITCH.white : STITCH.primary} />
            <Text style={[styles.pestanaTexto, pestana === p.id && styles.pestanaTextoActiva]}>{p.texto}</Text>
            {p.id === "visitas" && pendientes ? <View style={styles.badge}><Text style={styles.badgeTexto}>{pendientes}</Text></View> : null}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
        {pestana === "oficinas" ? (
          oficinas === null ? <ActivityIndicator color={STITCH.primary} style={{ marginTop: 40 }} /> :
          oficinas.length ? oficinas.map((o) => (
            <TouchableOpacity key={o.id} style={styles.tarjeta} onPress={() => setDetalle(o.id)}>
              <Logo empresa={o} />
              <View style={styles.flex}>
                <Text style={styles.tarjetaTitulo}>{o.nombre}</Text>
                <Text style={styles.meta}>{o.categoria_nombre || "Oficina"}</Text>
                <Text style={styles.ubicacion}>Piso {o.piso || "—"} · Oficina {o.local || "—"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={STITCH.outline} />
            </TouchableOpacity>
          )) : <Text style={styles.vacio}>Todavía no hay oficinas publicadas.</Text>
        ) : null}

        {pestana === "solicitar" ? (
          <View style={styles.formulario}>
            <Text style={styles.label}>¿A qué oficina vas?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(oficinas || []).map((o) => (
                <TouchableOpacity key={o.id} onPress={() => setForm({ ...form, oficina: o })}
                  style={[styles.chip, form.oficina?.id === o.id && styles.chipActivo]}>
                  <Text style={[styles.chipTexto, form.oficina?.id === o.id && styles.chipTextoActivo]}>{o.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Día</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {proximosDias.map((d, i) => (
                <TouchableOpacity key={d} onPress={() => setForm({ ...form, fecha: d })}
                  style={[styles.chip, form.fecha === d && styles.chipActivo]}>
                  <Text style={[styles.chipTexto, form.fecha === d && styles.chipTextoActivo]}>
                    {i === 0 ? "Hoy" : i === 1 ? "Mañana" : fechaBonita(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Hora</Text>
            <View style={styles.chipsGrid}>
              {HORAS.map((h) => (
                <TouchableOpacity key={h} onPress={() => setForm({ ...form, hora: h })}
                  style={[styles.chip, form.hora === h && styles.chipActivo]}>
                  <Text style={[styles.chipTexto, form.hora === h && styles.chipTextoActivo]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Motivo (opcional)</Text>
            <TextInput style={styles.input} value={form.motivo} onChangeText={(t) => setForm({ ...form, motivo: t })}
              placeholder="Ej. Consulta, reunión, entrega de documentos" placeholderTextColor={STITCH.outline} />
            <View style={styles.aviso}>
              <Ionicons name="information-circle" size={18} color={STITCH.secondary} />
              <Text style={styles.avisoTexto}>
                La oficina aprobará tu visita. Luego tendrás un QR para mostrar al guardia en la entrada.
              </Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.botonPrincipal} onPress={enviar} disabled={enviando}>
              {enviando ? <ActivityIndicator color={STITCH.white} /> : <Text style={styles.botonPrincipalTexto}>Enviar solicitud</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {pestana === "visitas" ? (
          visitas.length ? visitas.map((v) => {
            const [fondo, texto] = COLOR_ESTADO[v.estado] || COLOR_ESTADO.CANCELADA;
            const vigente = v.estado === "PENDIENTE" || v.estado === "APROBADA";
            return (
              <View key={v.id} style={styles.visita}>
                <View style={styles.visitaCabecera}>
                  <Text style={styles.tarjetaTitulo}>{v.oficina_nombre}</Text>
                  <Text style={[styles.estado, { backgroundColor: fondo, color: texto }]}>{v.estado_nombre}</Text>
                </View>
                <Text style={styles.meta}>
                  {fechaBonita(v.fecha)}{v.hora ? ` · ${v.hora.slice(0, 5)}` : ""} · Piso {v.oficina_piso || "—"}, oficina {v.oficina_local || "—"}
                </Text>
                {v.motivo ? <Text style={styles.ubicacion}>{v.motivo}</Text> : null}
                {v.origen === "INVITACION" ? <Text style={styles.invitado}>✉️ Te invitó la oficina</Text> : null}
                {v.estado === "RECHAZADA" && v.motivo_rechazo ? <Text style={styles.error}>{v.motivo_rechazo}</Text> : null}
                {v.qr ? (
                  <TouchableOpacity style={styles.botonQr} onPress={() => setQrAbierto(v)}>
                    <Ionicons name="qr-code" size={18} color={STITCH.white} />
                    <Text style={styles.botonPrincipalTexto}>Mostrar QR al guardia</Text>
                  </TouchableOpacity>
                ) : null}
                {vigente ? (
                  <TouchableOpacity onPress={() => cancelar(v)}><Text style={styles.enlace}>Cancelar visita</Text></TouchableOpacity>
                ) : null}
              </View>
            );
          }) : <Text style={styles.vacio}>Aún no tienes visitas. Solicita una desde la pestaña “Solicitar”.</Text>
        ) : null}
      </ScrollView>

      {detalle ? <DetalleOficina id={detalle} onCerrar={() => setDetalle(null)} onSolicitar={irASolicitar} /> : null}

      <Modal visible={Boolean(qrAbierto)} animationType="fade" transparent onRequestClose={() => setQrAbierto(null)}>
        <View style={styles.qrFondo}>
          {qrAbierto ? (
            <View style={styles.qrTarjeta}>
              <Text style={styles.qrTitulo}>{qrAbierto.oficina_nombre}</Text>
              <Text style={styles.meta}>{qrAbierto.visitante_nombre} · {fechaBonita(qrAbierto.fecha)}{qrAbierto.hora ? ` ${qrAbierto.hora.slice(0, 5)}` : ""}</Text>
              <View style={styles.qrCaja}><QRCode value={qrAbierto.qr} size={220} /></View>
              <Text style={styles.qrCodigo}>{qrAbierto.codigo}</Text>
              <Text style={styles.ubicacion}>Muéstralo al guardia en la entrada del Paseo.</Text>
              <TouchableOpacity style={styles.botonPrincipal} onPress={() => setQrAbierto(null)}>
                <Text style={styles.botonPrincipalTexto}>Listo</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.surface },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 6 },
  titulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 24 },
  sub: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  pestanas: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  pestana: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10,
    borderRadius: 999, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  pestanaActiva: { backgroundColor: STITCH.primary },
  pestanaTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  pestanaTextoActiva: { color: STITCH.white },
  badge: { backgroundColor: STITCH.oro, borderRadius: 999, minWidth: 18, paddingHorizontal: 5, alignItems: "center" },
  badgeTexto: { color: "#5a4100", fontFamily: FUENTES.titulo, fontSize: 11 },
  contenido: { padding: 16, paddingBottom: 40, gap: 12 },
  vacio: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, textAlign: "center", marginTop: 24 },
  tarjeta: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    padding: 14, ...SOMBRA },
  logo: { width: 52, height: 52, borderRadius: 14 },
  logoGrande: { width: 76, height: 76, borderRadius: 18 },
  logoVacio: { backgroundColor: STITCH.primaryContainer, alignItems: "center", justifyContent: "center" },
  logoLetra: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 18 },
  tarjetaTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 16, flexShrink: 1 },
  meta: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12.5, marginTop: 2 },
  ubicacion: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13, marginTop: 2 },
  formulario: { backgroundColor: STITCH.surfaceLowest, borderRadius: 18, padding: 16, ...SOMBRA },
  label: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 14, marginTop: 12, marginBottom: 6 },
  chips: { gap: 8, paddingBottom: 2 },
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: STITCH.surfaceLow },
  chipActivo: { backgroundColor: STITCH.primary },
  chipTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  chipTextoActivo: { color: STITCH.white },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: STITCH.surfaceLow, color: STITCH.onSurface,
    fontFamily: FUENTES.texto, fontSize: 15 },
  aviso: { flexDirection: "row", gap: 8, backgroundColor: "#EAF6FC", borderRadius: 12, padding: 12, marginTop: 14 },
  avisoTexto: { flex: 1, color: STITCH.primaryContainer, fontFamily: FUENTES.texto, fontSize: 13 },
  error: { color: STITCH.error, fontFamily: FUENTES.textoMedio, marginTop: 8 },
  botonPrincipal: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: STITCH.primary,
    borderRadius: 999, paddingVertical: 14, marginTop: 16 },
  botonPrincipalTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  botonWhatsapp: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#DCFCE7",
    borderRadius: 999, paddingVertical: 12, marginTop: 10 },
  botonWhatsappTexto: { color: "#166534", fontFamily: FUENTES.tituloBold, fontSize: 14 },
  visita: { backgroundColor: STITCH.surfaceLowest, borderRadius: 16, padding: 14, ...SOMBRA },
  visitaCabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  estado: { fontFamily: FUENTES.textoFuerte, fontSize: 11.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    overflow: "hidden" },
  invitado: { color: "#8A5A00", fontFamily: FUENTES.textoMedio, fontSize: 12.5, marginTop: 4 },
  botonQr: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: STITCH.primaryContainer,
    borderRadius: 999, paddingVertical: 11, marginTop: 12 },
  enlace: { color: STITCH.error, fontFamily: FUENTES.textoFuerte, fontSize: 13, textAlign: "center", marginTop: 10 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { maxHeight: "90%", backgroundColor: STITCH.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalCerrar: { position: "absolute", top: 12, right: 12, zIndex: 2, padding: 6 },
  detalleCabecera: { flexDirection: "row", gap: 14, alignItems: "center", paddingRight: 30 },
  detalleTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 21 },
  lema: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 13.5, marginTop: 2 },
  descripcion: { color: STITCH.onSurface, fontFamily: FUENTES.texto, fontSize: 14.5, lineHeight: 21, marginTop: 14 },
  datoFila: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "flex-start" },
  dato: { flex: 1, color: STITCH.onSurface, fontFamily: FUENTES.textoMedio, fontSize: 14 },
  subtitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 16, marginTop: 18, marginBottom: 6 },
  horarioFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1,
    borderBottomColor: STITCH.surfaceContainer },
  horarioDia: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13.5 },
  horarioHora: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  cerrado: { color: STITCH.outline },
  servicio: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: STITCH.surfaceContainer },
  servicioNombre: { color: STITCH.onSurface, fontFamily: FUENTES.textoMedio, fontSize: 14, flex: 1 },
  servicioPrecio: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  fotos: { gap: 10, marginTop: 14 },
  foto: { width: 160, height: 110, borderRadius: 12 },
  qrFondo: { flex: 1, backgroundColor: "rgba(0,20,35,0.85)", alignItems: "center", justifyContent: "center", padding: 20 },
  qrTarjeta: { width: "100%", maxWidth: 360, backgroundColor: STITCH.white, borderRadius: 24, padding: 22, alignItems: "center" },
  qrTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20, textAlign: "center" },
  qrCaja: { padding: 14, backgroundColor: STITCH.white, borderRadius: 16, marginTop: 14, borderWidth: 1, borderColor: STITCH.surfaceHigh },
  qrCodigo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 26, letterSpacing: 5, marginTop: 10 },
});
