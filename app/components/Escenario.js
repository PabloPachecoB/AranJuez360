import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import {
  cancelarCupo,
  enviarPropuesta,
  getEspacios,
  getMisEntradas,
  getMisPropuestas,
  reservarCupo,
  retirarPropuesta,
} from "../services/diversionService";

// Escenario abierto: la comunidad propone su presentación (música, podcast, taller...), el Paseo la
// aprueba según disponibilidad y se publica como evento con acceso libre o con cupos (entrada con QR).

const TIPOS = [
  ["MUSICA", "Música en vivo", "musical-notes"],
  ["PODCAST", "Podcast o charla", "mic"],
  ["ARTE", "Arte y cultura", "color-palette"],
  ["TALLER", "Taller", "construct"],
  ["OTRO", "Otro", "sparkles"],
];
const HORAS = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const DURACIONES = [[60, "1 h"], [90, "1 h 30"], [120, "2 h"], [180, "3 h"], [240, "4 h"]];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ESTADO = {
  PENDIENTE: { color: "#8A5A00", fondo: "#FFF4CC", icono: "time-outline", texto: "En revisión" },
  APROBADA: { color: "#047857", fondo: "#D1FAE5", icono: "checkmark-circle", texto: "Aprobada y publicada" },
  RECHAZADA: { color: "#B91C1C", fondo: "#FEE2E2", icono: "close-circle", texto: "No aprobada" },
  CANCELADA: { color: STITCH.outline, fondo: STITCH.surfaceLow, icono: "remove-circle-outline", texto: "Retirada" },
};

const hora = (iso) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
const fechaCorta = (iso) => {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
};

function Chip({ activo, onPress, children, icono }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      {icono ? <Ionicons name={icono} size={14} color={activo ? STITCH.white : STITCH.primary} /> : null}
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{children}</Text>
    </TouchableOpacity>
  );
}

function Campo({ label, ayuda, ...props }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput placeholderTextColor={STITCH.outline} {...props}
        style={[styles.input, props.multiline && styles.inputLargo]} />
      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

/** QR de una entrada (se valida en la puerta). */
export function EntradaQR({ entrada, onCancelar, cancelando }) {
  return (
    <View style={styles.entrada}>
      <Text style={styles.entradaTitulo}>Tu entrada</Text>
      <View style={styles.qrCaja}><QRCode value={entrada.qr} size={200} /></View>
      <Text style={styles.codigo}>{entrada.codigo}</Text>
      <Text style={styles.entradaMeta}>
        {entrada.cantidad} {entrada.cantidad === 1 ? "cupo" : "cupos"} · {fechaCorta(entrada.inicio)} · {hora(entrada.inicio)}
      </Text>
      <Text style={styles.ayudaCentro}>Muéstralo en la puerta del evento.</Text>
      {onCancelar ? (
        <TouchableOpacity onPress={onCancelar} disabled={cancelando} style={styles.botonTexto}>
          <Text style={styles.botonTextoRojo}>{cancelando ? "Cancelando…" : "Cancelar mi reserva"}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Bloque de cupos dentro del detalle del evento: disponibilidad, reservar y entrada con QR. */
export function CuposEvento({ evento, onCambio }) {
  const [reserva, setReserva] = useState(evento.mi_reserva);
  const [cantidad, setCantidad] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [reservados, setReservados] = useState(evento.reservados);

  if (evento.acceso !== "CUPOS") {
    return (
      <View style={[styles.cupos, styles.cuposLibre]}>
        <Ionicons name="walk-outline" size={20} color="#047857" />
        <Text style={styles.cuposLibreTexto}>Acceso libre: no necesitas reservar, ¡solo ven!</Text>
      </View>
    );
  }

  const libres = Math.max(0, evento.cupos - reservados);
  const progreso = evento.cupos ? reservados / evento.cupos : 0;

  const reservar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const nueva = await reservarCupo(evento.id, cantidad);
      setReserva(nueva);
      setReservados((r) => r + nueva.cantidad);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await cancelarCupo(reserva.id);
      setReservados((r) => Math.max(0, r - reserva.cantidad));
      setReserva(null);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <View style={styles.cupos}>
      <View style={styles.cuposFila}>
        <Text style={styles.cuposTitulo}>Cupos</Text>
        <Text style={styles.cuposNumero}>{reservados} de {evento.cupos} reservados</Text>
      </View>
      <View style={styles.barra}><View style={[styles.barraLlena, { width: `${Math.min(100, progreso * 100)}%` }]} /></View>
      <Text style={[styles.cuposEstado, !libres && styles.agotado]}>
        {libres ? `Quedan ${libres} ${libres === 1 ? "cupo" : "cupos"}` : "Cupos agotados"}
      </Text>

      {reserva ? (
        <EntradaQR entrada={reserva} onCancelar={cancelar} cancelando={ocupado} />
      ) : libres ? (
        <>
          <View style={styles.cantidadFila}>
            <Text style={styles.campoLabel}>¿Cuántos cupos?</Text>
            <View style={styles.contador}>
              <TouchableOpacity onPress={() => setCantidad((c) => Math.max(1, c - 1))} style={styles.contadorBoton}
                accessibilityLabel="Menos cupos">
                <Ionicons name="remove" size={18} color={STITCH.primary} />
              </TouchableOpacity>
              <Text style={styles.contadorNumero}>{cantidad}</Text>
              <TouchableOpacity onPress={() => setCantidad((c) => Math.min(4, libres, c + 1))} style={styles.contadorBoton}
                accessibilityLabel="Más cupos">
                <Ionicons name="add" size={18} color={STITCH.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.botonPrimario} onPress={reservar} disabled={ocupado}>
            {ocupado ? <ActivityIndicator color={STITCH.white} /> : (
              <>
                <Ionicons name="ticket" size={18} color={STITCH.white} />
                <Text style={styles.botonPrimarioTexto}>Reservar {cantidad === 1 ? "mi cupo" : `${cantidad} cupos`}</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Formulario para proponer una presentación. Al enviarla le llega al admin. */
function FormPropuesta({ espacios, onCerrar, onEnviada }) {
  const dias = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i + 1);
    return d;
  }), []);
  const [form, setForm] = useState({
    espacio: espacios[0]?.id ?? null, tipo: "MUSICA", artista: "", titulo: "", personas: "",
    dia: 1, hora: "19:00", duracion: 120, acceso: "LIBRE", descripcion: "", necesidades: "",
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const espacio = espacios.find((e) => e.id === form.espacio);

  const enviar = async () => {
    const personas = parseInt(form.personas, 10);
    if (!form.artista.trim() || !form.titulo.trim() || !form.descripcion.trim() || !personas) {
      setError("Completa tu nombre artístico, el nombre de la presentación, para cuántas personas y la descripción.");
      return;
    }
    const [h, m] = form.hora.split(":").map(Number);
    const inicio = new Date(dias[form.dia]);
    inicio.setHours(h, m, 0, 0);
    const fin = new Date(inicio.getTime() + form.duracion * 60000);
    setEnviando(true);
    setError(null);
    try {
      await enviarPropuesta({
        espacio: form.espacio, tipo: form.tipo, artista: form.artista.trim(), titulo: form.titulo.trim(),
        personas, inicio: inicio.toISOString(), fin: fin.toISOString(), acceso: form.acceso,
        descripcion: form.descripcion.trim(), necesidades: form.necesidades.trim(),
      });
      onEnviada();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <View style={styles.modal}>
          <View style={styles.modalCabecera}>
            <View style={styles.flex}>
              <Text style={styles.modalTitulo}>Proponer mi presentación</Text>
              <Text style={styles.ayuda}>El Paseo la revisa según disponibilidad y te avisa por correo.</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar" style={styles.cerrar}>
              <Ionicons name="close" size={24} color={STITCH.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formulario}>
            <Text style={styles.seccion}>¿Qué vas a presentar?</Text>
            <View style={styles.chips}>
              {TIPOS.map(([k, t, i]) => <Chip key={k} icono={i} activo={form.tipo === k} onPress={() => set("tipo")(k)}>{t}</Chip>)}
            </View>
            <Campo label="Tu nombre artístico o del grupo *" value={form.artista} onChangeText={set("artista")}
              placeholder="Ej. Juan y su guitarra" maxLength={120} />
            <Campo label="Nombre de la presentación *" value={form.titulo} onChangeText={set("titulo")}
              placeholder="Ej. Acústico de sábado" maxLength={150} />
            <Campo label="¿Para cuántas personas? *" value={form.personas} onChangeText={(t) => set("personas")(t.replace(/\D/g, ""))}
              keyboardType="number-pad" placeholder="Público que esperas"
              ayuda={espacio ? `En ${espacio.nombre} caben hasta ${espacio.capacidad} personas.` : null} />

            <Text style={styles.seccion}>¿Dónde?</Text>
            <View style={styles.chips}>
              {espacios.map((e) => (
                <Chip key={e.id} activo={form.espacio === e.id} onPress={() => set("espacio")(e.id)}>{e.nombre}</Chip>
              ))}
            </View>
            {espacio ? (
              <View style={styles.espacioInfo}>
                <Text style={styles.espacioLugar}><Ionicons name="location-outline" size={13} /> {espacio.lugar}</Text>
                {espacio.equipamiento ? <Text style={styles.ayuda}>Tiene: {espacio.equipamiento}</Text> : null}
              </View>
            ) : null}

            <Text style={styles.seccion}>¿Qué día?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollChips} contentContainerStyle={styles.chipsFila}>
              {dias.map((d, i) => (
                <Chip key={i} activo={form.dia === i} onPress={() => set("dia")(i)}>
                  {i === 0 ? "Mañana" : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`}
                </Chip>
              ))}
            </ScrollView>
            <Text style={styles.seccion}>¿A qué hora empieza?</Text>
            <View style={styles.chips}>
              {HORAS.map((h) => <Chip key={h} activo={form.hora === h} onPress={() => set("hora")(h)}>{h}</Chip>)}
            </View>
            <Text style={styles.seccion}>¿Cuánto dura?</Text>
            <View style={styles.chips}>
              {DURACIONES.map(([min, t]) => <Chip key={min} activo={form.duracion === min} onPress={() => set("duracion")(min)}>{t}</Chip>)}
            </View>

            <Text style={styles.seccion}>¿Cómo entra el público?</Text>
            <View style={styles.chips}>
              <Chip icono="walk-outline" activo={form.acceso === "LIBRE"} onPress={() => set("acceso")("LIBRE")}>Acceso libre</Chip>
              <Chip icono="ticket-outline" activo={form.acceso === "CUPOS"} onPress={() => set("acceso")("CUPOS")}>Con cupos (reserva)</Chip>
            </View>
            <Text style={styles.ayuda}>
              {form.acceso === "CUPOS"
                ? "El público reserva su cupo en la app y entra con un QR. El Paseo define cuántos cupos al aprobar."
                : "Cualquiera puede llegar sin reservar."}
            </Text>

            <Campo label="Cuéntanos de qué se trata *" value={form.descripcion} onChangeText={set("descripcion")}
              multiline placeholder="Repertorio, tema del podcast, a quién va dirigido…" />
            <Campo label="¿Qué vas a necesitar?" value={form.necesidades} onChangeText={set("necesidades")}
              multiline placeholder="Sonido, micrófonos, sillas, proyector, enchufes…" />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.botonPrimario} onPress={enviar} disabled={enviando}>
              {enviando ? <ActivityIndicator color={STITCH.white} /> : (
                <>
                  <Ionicons name="send" size={17} color={STITCH.white} />
                  <Text style={styles.botonPrimarioTexto}>Enviar solicitud</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Pestaña "Escenario" de Diversión: proponer, mis entradas con QR y mis solicitudes. */
export function PanelEscenario({ version, onVerEvento }) {
  const [espacios, setEspacios] = useState([]);
  const [propuestas, setPropuestas] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [form, setForm] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [e, p, t] = await Promise.all([getEspacios(), getMisPropuestas(), getMisEntradas()]);
      setEspacios(e);
      setPropuestas(p);
      setEntradas(t);
      setError(null);
    } catch (err) {
      setError(err.message);
      setPropuestas([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  const retirar = async (p) => {
    try {
      await retirarPropuesta(p.id);
      cargar();
    } catch (err) {
      setAviso(err.message);
    }
  };

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroIcono}><Ionicons name="mic" size={26} color={STITCH.white} /></View>
        <Text style={styles.heroTitulo}>Escenario abierto</Text>
        <Text style={styles.heroTexto}>
          ¿Tocas guitarra, haces un podcast o quieres dar un taller? Pide un espacio del Paseo para presentarte.
          Te avisamos cuando esté aprobado y lo publicamos en la app.
        </Text>
        <TouchableOpacity style={styles.heroBoton} onPress={() => { setAviso(null); setForm(true); }}
          disabled={!espacios.length}>
          <Ionicons name="add-circle" size={18} color={STITCH.primary} />
          <Text style={styles.heroBotonTexto}>Proponer mi presentación</Text>
        </TouchableOpacity>
      </View>
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.titulo}>Mis entradas</Text>
      {entradas.length ? entradas.map((t) => (
        <TouchableOpacity key={t.id} style={styles.fila} onPress={() => setQr(t)}>
          <View style={styles.filaIcono}><Ionicons name="qr-code" size={22} color={STITCH.primary} /></View>
          <View style={styles.flex}>
            <Text style={styles.filaTitulo}>{t.titulo}</Text>
            <Text style={styles.filaMeta}>{fechaCorta(t.inicio)} · {hora(t.inicio)} · {t.cantidad} {t.cantidad === 1 ? "cupo" : "cupos"}</Text>
            <Text style={styles.filaMeta} numberOfLines={1}>{t.lugar}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={STITCH.outline} />
        </TouchableOpacity>
      )) : <Text style={styles.vacio}>Cuando reserves cupo en un evento, tu entrada con QR aparecerá aquí.</Text>}

      <Text style={styles.titulo}>Mis solicitudes</Text>
      {propuestas === null ? <ActivityIndicator color={STITCH.primary} /> : propuestas.length ? propuestas.map((p) => {
        const e = ESTADO[p.estado] || ESTADO.PENDIENTE;
        return (
          <View key={p.id} style={styles.fila}>
            <View style={styles.flex}>
              <View style={[styles.estado, { backgroundColor: e.fondo }]}>
                <Ionicons name={e.icono} size={13} color={e.color} />
                <Text style={[styles.estadoTexto, { color: e.color }]}>{e.texto}</Text>
              </View>
              <Text style={styles.filaTitulo}>{p.titulo}</Text>
              <Text style={styles.filaMeta}>{p.artista} · {p.tipo_nombre}</Text>
              <Text style={styles.filaMeta}>{fechaCorta(p.inicio)} · {hora(p.inicio)}–{hora(p.fin)} · {p.espacio_nombre}</Text>
              {p.estado === "APROBADA" ? (
                <Text style={styles.filaMeta}>
                  {p.cupos ? `${p.reservados} de ${p.cupos} cupos reservados` : "Acceso libre"}
                </Text>
              ) : null}
              {p.estado === "RECHAZADA" && p.motivo_rechazo ? <Text style={styles.motivo}>Motivo: {p.motivo_rechazo}</Text> : null}
            </View>
            {p.estado === "PENDIENTE" ? (
              <TouchableOpacity onPress={() => retirar(p)} style={styles.botonTexto}>
                <Text style={styles.botonTextoRojo}>Retirar</Text>
              </TouchableOpacity>
            ) : p.estado === "APROBADA" && p.evento ? (
              <TouchableOpacity onPress={() => onVerEvento?.(p.evento)} style={styles.botonTexto}>
                <Text style={styles.botonTextoAzul}>Ver evento</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }) : <Text style={styles.vacio}>Aún no enviaste ninguna solicitud.</Text>}

      {espacios.length ? (
        <>
          <Text style={styles.titulo}>Espacios que puedes pedir</Text>
          {espacios.map((e) => (
            <View key={e.id} style={styles.fila}>
              <View style={styles.filaIcono}><Ionicons name="easel-outline" size={22} color={STITCH.primary} /></View>
              <View style={styles.flex}>
                <Text style={styles.filaTitulo}>{e.nombre}</Text>
                <Text style={styles.filaMeta}>{e.lugar} · hasta {e.capacidad} personas</Text>
                {e.descripcion ? <Text style={styles.filaMeta}>{e.descripcion}</Text> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {form ? (
        <FormPropuesta espacios={espacios} onCerrar={() => setForm(false)}
          onEnviada={() => {
            setForm(false);
            setAviso("¡Solicitud enviada! El Paseo la revisará según disponibilidad y te avisará por correo.");
            cargar();
          }} />
      ) : null}

      {qr ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setQr(null)}>
          <View style={[styles.modalFondo, styles.centrado]}>
            <View style={styles.qrModal}>
              <TouchableOpacity onPress={() => setQr(null)} style={styles.cerrarQr} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color={STITCH.onSurface} />
              </TouchableOpacity>
              <Text style={styles.modalTitulo}>{qr.titulo}</Text>
              <Text style={styles.filaMeta}>{qr.lugar}</Text>
              <EntradaQR entrada={qr} onCancelar={async () => {
                try {
                  await cancelarCupo(qr.id);
                  setQr(null);
                  cargar();
                } catch (err) {
                  setAviso(err.message);
                  setQr(null);
                }
              }} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centrado: { justifyContent: "center", alignItems: "center", padding: 20 },
  hero: { backgroundColor: STITCH.primary, borderRadius: 20, padding: 18, gap: 8, ...SOMBRA },
  heroIcono: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center",
    justifyContent: "center" },
  heroTitulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 21 },
  heroTexto: { color: "rgba(255,255,255,0.85)", fontFamily: FUENTES.texto, fontSize: 13.5, lineHeight: 19 },
  heroBoton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6,
    backgroundColor: STITCH.secondaryContainer, borderRadius: 999, paddingVertical: 12 },
  heroBotonTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  aviso: { color: "#047857", backgroundColor: "#D1FAE5", borderRadius: 12, padding: 12, fontFamily: FUENTES.textoMedio,
    fontSize: 13.5 },
  titulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 17, marginTop: 8 },
  vacio: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    padding: 14, ...SOMBRA },
  filaIcono: { width: 44, height: 44, borderRadius: 12, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center" },
  filaTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 15.5, marginTop: 2 },
  filaMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5, marginTop: 2 },
  motivo: { color: "#B91C1C", fontFamily: FUENTES.texto, fontSize: 12.5, marginTop: 4 },
  estado: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2 },
  estadoTexto: { fontFamily: FUENTES.textoFuerte, fontSize: 11.5 },
  botonTexto: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: "center" },
  botonTextoRojo: { color: "#B91C1C", fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  botonTextoAzul: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  error: { color: "#B91C1C", fontFamily: FUENTES.texto, fontSize: 13, marginTop: 6 },

  // Modal del formulario
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { width: "100%", maxWidth: 560, alignSelf: "center", maxHeight: "92%", backgroundColor: STITCH.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18 },
  modalCabecera: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  modalTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  cerrar: { padding: 4 },
  formulario: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  seccion: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 14.5, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scrollChips: { flexGrow: 0 },
  chipsFila: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: STITCH.surfaceLow },
  chipActivo: { backgroundColor: STITCH.primary },
  chipTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  chipTextoActivo: { color: STITCH.white },
  campo: { gap: 4, marginTop: 4 },
  campoLabel: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  input: { backgroundColor: STITCH.surfaceLowest, borderRadius: 12, borderWidth: 1, borderColor: STITCH.outlineVariant,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FUENTES.texto, fontSize: 14.5, color: STITCH.onSurface },
  inputLargo: { minHeight: 84, textAlignVertical: "top" },
  ayuda: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12 },
  ayudaCentro: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12, textAlign: "center" },
  espacioInfo: { backgroundColor: STITCH.surfaceLow, borderRadius: 12, padding: 10, gap: 2 },
  espacioLugar: { color: STITCH.onSurface, fontFamily: FUENTES.textoMedio, fontSize: 13 },
  botonPrimario: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12,
    backgroundColor: STITCH.primary, borderRadius: 999, paddingVertical: 14, minHeight: 50 },
  botonPrimarioTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },

  // Cupos del evento
  cupos: { marginTop: 16, backgroundColor: STITCH.surfaceLowest, borderRadius: 16, padding: 14, gap: 6, ...SOMBRA },
  cuposLibre: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#D1FAE5" },
  cuposLibreTexto: { flex: 1, color: "#047857", fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  cuposFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cuposTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 16 },
  cuposNumero: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  barra: { height: 8, borderRadius: 4, backgroundColor: STITCH.surfaceLow, overflow: "hidden" },
  barraLlena: { height: "100%", borderRadius: 4, backgroundColor: STITCH.secondary },
  cuposEstado: { color: "#047857", fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  agotado: { color: "#B91C1C" },
  cantidadFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  contador: { flexDirection: "row", alignItems: "center", gap: 14 },
  contadorBoton: { width: 34, height: 34, borderRadius: 17, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center" },
  contadorNumero: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 18, minWidth: 18, textAlign: "center" },

  // Entrada con QR
  entrada: { alignItems: "center", gap: 6, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: STITCH.outlineVariant },
  entradaTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 16 },
  qrCaja: { padding: 12, backgroundColor: STITCH.white, borderRadius: 16 },
  codigo: { color: STITCH.onSurface, fontFamily: FUENTES.titulo, fontSize: 20, letterSpacing: 3 },
  entradaMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 13 },
  qrModal: { width: "100%", maxWidth: 380, backgroundColor: STITCH.surface, borderRadius: 24, padding: 20, gap: 4 },
  cerrarQr: { position: "absolute", top: 12, right: 12, padding: 6, zIndex: 2 },
});
