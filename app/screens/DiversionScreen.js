import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { getDiversion } from "../services/diversionService";
import { getRecompensas } from "../services/puntosService";

const PESTANAS = [
  { id: "cartelera", texto: "Cartelera", icono: "film" },
  { id: "eventos", texto: "Eventos", icono: "calendar" },
  { id: "juegos", texto: "Juegos", icono: "game-controller" },
];

// Pósters de respaldo mientras el cine no suba las imágenes.
const FONDOS = ["#1b4965", "#7c2d12", "#3f3d8f", "#065f46", "#5a4100", "#831843"];
const ICONO_EVENTO = {
  MUSICA: "musical-notes", CULTURA: "color-palette", INFANTIL: "happy",
  GASTRONOMIA: "restaurant", DEPORTE: "football", OTRO: "sparkles",
};
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const hora = (iso) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
const claveDia = (iso) => new Date(iso).toDateString();
const fmt = (n) => Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });

function nombreDia(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === manana.toDateString()) return "Mañana";
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}

function Poster({ pelicula, indice, grande }) {
  const estilo = [styles.poster, grande && styles.posterGrande, { backgroundColor: FONDOS[indice % FONDOS.length] }];
  if (pelicula.poster) return <Image source={{ uri: pelicula.poster }} style={estilo} />;
  return (
    <View style={estilo}>
      <Ionicons name="film" size={grande ? 54 : 36} color="rgba(255,255,255,0.35)" />
      <Text style={[styles.posterTitulo, grande && styles.posterTituloGrande]} numberOfLines={3}>{pelicula.titulo}</Text>
    </View>
  );
}

/** Detalle de una película: sinopsis y funciones agrupadas por día. */
function DetallePelicula({ pelicula, indice, entradaCine, onCerrar, onJarvis }) {
  const dias = useMemo(() => {
    const grupos = [];
    for (const f of pelicula?.funciones || []) {
      const clave = claveDia(f.inicio);
      let grupo = grupos.find((g) => g.clave === clave);
      if (!grupo) grupos.push((grupo = { clave, nombre: nombreDia(f.inicio), funciones: [] }));
      grupo.funciones.push(f);
    }
    return grupos;
  }, [pelicula]);
  const [dia, setDia] = useState(0);
  useEffect(() => setDia(0), [pelicula]);
  if (!pelicula) return null;
  const seleccion = dias[dia];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <View style={styles.modal}>
          <TouchableOpacity onPress={onCerrar} style={styles.modalCerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={24} color={STITCH.onSurface} />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detalleCabecera}>
              <Poster pelicula={pelicula} indice={indice} grande />
              <View style={styles.flex}>
                {pelicula.estreno ? <Text style={styles.estreno}>ESTRENO</Text> : null}
                <Text style={styles.detalleTitulo}>{pelicula.titulo}</Text>
                <Text style={styles.detalleMeta}>{pelicula.genero}</Text>
                <View style={styles.metaFila}>
                  <Text style={styles.clasificacion}>{pelicula.clasificacion}</Text>
                  <Text style={styles.detalleMeta}>{pelicula.duracion_min} min</Text>
                </View>
              </View>
            </View>
            {pelicula.sinopsis ? <Text style={styles.sinopsis}>{pelicula.sinopsis}</Text> : null}

            {entradaCine ? (
              <View style={styles.canje}>
                <Ionicons name="ticket" size={20} color="#8A5A00" />
                <Text style={styles.canjeTexto}>
                  Entrada gratis canjeando <Text style={styles.negrita}>{fmt(entradaCine.costo_puntos)} monedas</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.subtitulo}>Funciones</Text>
            {dias.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diasFila}>
                  {dias.map((d, i) => (
                    <TouchableOpacity key={d.clave} onPress={() => setDia(i)}
                      style={[styles.diaChip, i === dia && styles.diaChipActivo]}>
                      <Text style={[styles.diaTexto, i === dia && styles.diaTextoActivo]}>{d.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.horarios}>
                  {seleccion?.funciones.map((f) => (
                    <View key={f.id} style={styles.horario}>
                      <Text style={styles.horarioHora}>{hora(f.inicio)}</Text>
                      <Text style={styles.horarioDetalle}>{f.formato} · {f.idioma_nombre}</Text>
                      <Text style={styles.horarioDetalle}>{f.sala}{f.precio ? ` · Bs ${fmt(f.precio)}` : ""}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.vacioTexto}>Próximamente en cartelera.</Text>
            )}

            <TouchableOpacity style={styles.botonJarvis} onPress={onJarvis}>
              <Ionicons name="sparkles" size={18} color={STITCH.primary} />
              <Text style={styles.botonJarvisTexto}>Preguntarle a Jarvis</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function DiversionScreen({ navigation, route }) {
  const [pestana, setPestana] = useState(route?.params?.pestana || "cartelera");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [entradaCine, setEntradaCine] = useState(null);
  const [detalle, setDetalle] = useState(null); // { pelicula, indice }

  const cargar = useCallback(async () => {
    try {
      setDatos(await getDiversion());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    try {
      const recompensas = await getRecompensas();
      const lista = recompensas.results || recompensas;
      setEntradaCine(lista.find((r) => r.categoria === "CINE") || null);
    } catch {
      setEntradaCine(null); // solo los clientes ven recompensas
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

  const preguntar = (pregunta) => {
    setDetalle(null);
    navigation.navigate("Asistente", { pregunta });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Diversión</Text>
          <Text style={styles.sub}>Cine, eventos y juegos del Paseo</Text>
        </View>
      </View>

      <View style={styles.pestanas}>
        {PESTANAS.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setPestana(p.id)}
            style={[styles.pestana, pestana === p.id && styles.pestanaActiva]}>
            <Ionicons name={p.icono} size={16} color={pestana === p.id ? STITCH.white : STITCH.primary} />
            <Text style={[styles.pestanaTexto, pestana === p.id && styles.pestanaTextoActiva]}>{p.texto}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!datos && !error ? (
        <ActivityIndicator style={styles.cargando} size="large" color={STITCH.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
          {error ? <Text style={styles.vacioTexto}>{error}</Text> : null}

          {pestana === "cartelera" && datos ? (
            datos.cartelera.length ? (
              <View style={styles.grilla}>
                {datos.cartelera.map((p, i) => {
                  const proxima = p.funciones[0];
                  return (
                    <TouchableOpacity key={p.id} style={styles.peli} onPress={() => setDetalle({ pelicula: p, indice: i })}>
                      <Poster pelicula={p} indice={i} />
                      {p.estreno ? <Text style={[styles.estreno, styles.estrenoFlotante]}>ESTRENO</Text> : null}
                      <Text style={styles.peliTitulo} numberOfLines={1}>{p.titulo}</Text>
                      <Text style={styles.peliMeta} numberOfLines={1}>{p.genero} · {p.clasificacion}</Text>
                      <Text style={styles.peliProxima}>
                        {proxima ? `${nombreDia(proxima.inicio)} ${hora(proxima.inicio)}` : "Próximamente"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : <Text style={styles.vacioTexto}>No hay películas en cartelera.</Text>
          ) : null}

          {pestana === "eventos" && datos ? (
            datos.eventos.length ? datos.eventos.map((e) => {
              const d = new Date(e.inicio);
              return (
                <TouchableOpacity key={e.id} style={styles.evento}
                  onPress={() => preguntar(`Cuéntame del evento "${e.titulo}"`)}>
                  <View style={[styles.fecha, e.destacado && styles.fechaDestacada]}>
                    <Text style={[styles.fechaDia, e.destacado && styles.blanco]}>{d.getDate()}</Text>
                    <Text style={[styles.fechaMes, e.destacado && styles.blanco]}>{MESES[d.getMonth()]}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.metaFila}>
                      <Ionicons name={ICONO_EVENTO[e.categoria] || "sparkles"} size={13} color={STITCH.secondary} />
                      <Text style={styles.eventoCategoria}>{e.categoria_nombre}</Text>
                      {e.destacado ? <Text style={styles.destacado}>DESTACADO</Text> : null}
                    </View>
                    <Text style={styles.eventoTitulo}>{e.titulo}</Text>
                    <Text style={styles.eventoMeta}>{nombreDia(e.inicio)} · {hora(e.inicio)}{e.lugar ? ` · ${e.lugar}` : ""}</Text>
                    <Text style={[styles.eventoPrecio, e.gratis && styles.gratis]}>
                      {e.gratis ? "Entrada libre" : `Bs ${fmt(e.precio)}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }) : <Text style={styles.vacioTexto}>No hay eventos próximos.</Text>
          ) : null}

          {pestana === "juegos" && datos ? (
            <>
              <View style={styles.bannerJuegos}>
                <Ionicons name="sparkles" size={20} color="#8A5A00" />
                <Text style={styles.bannerTexto}>Escanea el QR o NFC de cada juego y gana monedas.</Text>
              </View>
              {datos.actividades.length ? datos.actividades.map((a) => (
                <View key={a.id} style={styles.juego}>
                  <View style={styles.juegoIcono}>
                    <Ionicons name={/cine/i.test(a.nombre) ? "film" : "game-controller"} size={24} color={STITCH.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.eventoTitulo}>{a.nombre}</Text>
                    {a.descripcion ? <Text style={styles.eventoMeta}>{a.descripcion}</Text> : null}
                    <Text style={styles.juegoMonedas}>+{fmt(a.monedas)} monedas · cada {a.horas_espera} h</Text>
                  </View>
                  <TouchableOpacity style={styles.botonEscanear} onPress={() => navigation.navigate("Escanear")}
                    accessibilityLabel={`Escanear ${a.nombre}`}>
                    <Ionicons name="scan" size={20} color={STITCH.white} />
                  </TouchableOpacity>
                </View>
              )) : <Text style={styles.vacioTexto}>Pronto habrá juegos que dan monedas.</Text>}
            </>
          ) : null}
        </ScrollView>
      )}

      {detalle ? (
        <DetallePelicula pelicula={detalle.pelicula} indice={detalle.indice} entradaCine={entradaCine}
          onCerrar={() => setDetalle(null)}
          onJarvis={() => preguntar(`¿Qué me recomiendas sobre la película "${detalle.pelicula.titulo}"?`)} />
      ) : null}
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
  pestana: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10,
    borderRadius: 999, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  pestanaActiva: { backgroundColor: STITCH.primary },
  pestanaTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  pestanaTextoActiva: { color: STITCH.white },
  cargando: { marginTop: 60 },
  contenido: { padding: 16, paddingBottom: 40, gap: 12 },
  vacioTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, textAlign: "center", marginTop: 20 },

  grilla: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 },
  peli: { width: "48%" },
  poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 14, alignItems: "center", justifyContent: "center",
    padding: 10, overflow: "hidden" },
  posterGrande: { width: 120 },
  posterTitulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 16, textAlign: "center", marginTop: 8 },
  posterTituloGrande: { fontSize: 13 },
  estreno: { alignSelf: "flex-start", backgroundColor: STITCH.oro, color: "#5a4100", fontFamily: FUENTES.titulo,
    fontSize: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  estrenoFlotante: { position: "absolute", top: 8, left: 8 },
  peliTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 15, marginTop: 8 },
  peliMeta: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12 },
  peliProxima: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12, marginTop: 2 },

  evento: { flexDirection: "row", gap: 14, backgroundColor: STITCH.surfaceLowest, borderRadius: 16, padding: 14, ...SOMBRA },
  fecha: { width: 54, height: 60, borderRadius: 12, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center" },
  fechaDestacada: { backgroundColor: STITCH.primary },
  fechaDia: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22, lineHeight: 24 },
  fechaMes: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoFuerte, fontSize: 12 },
  blanco: { color: STITCH.white },
  metaFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  eventoCategoria: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12 },
  destacado: { color: "#5a4100", backgroundColor: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 9, borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  eventoTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 16, marginTop: 2 },
  eventoMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13, marginTop: 2 },
  eventoPrecio: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13, marginTop: 4 },
  gratis: { color: "#047857" },

  bannerJuegos: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF4CC", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "#F5B301" },
  bannerTexto: { flex: 1, color: "#8A5A00", fontFamily: FUENTES.textoMedio, fontSize: 13.5 },
  juego: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    padding: 14, ...SOMBRA },
  juegoIcono: { width: 48, height: 48, borderRadius: 24, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center" },
  juegoMonedas: { color: "#B7791F", fontFamily: FUENTES.textoFuerte, fontSize: 13, marginTop: 4 },
  botonEscanear: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.primary, alignItems: "center",
    justifyContent: "center" },

  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { maxHeight: "88%", backgroundColor: STITCH.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalCerrar: { position: "absolute", top: 12, right: 12, zIndex: 2, padding: 6 },
  detalleCabecera: { flexDirection: "row", gap: 16, alignItems: "flex-end" },
  detalleTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22, marginTop: 6 },
  detalleMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  clasificacion: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 11, borderWidth: 1.5,
    borderColor: STITCH.primary, borderRadius: 6, paddingHorizontal: 5, marginTop: 4 },
  sinopsis: { color: STITCH.onSurface, fontFamily: FUENTES.texto, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  canje: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF4CC", borderRadius: 12, padding: 12,
    marginTop: 14 },
  canjeTexto: { flex: 1, color: "#8A5A00", fontFamily: FUENTES.texto, fontSize: 13.5 },
  negrita: { fontFamily: FUENTES.textoFuerte },
  subtitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 17, marginTop: 18 },
  diasFila: { gap: 8, paddingVertical: 10 },
  diaChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: STITCH.surfaceLow },
  diaChipActivo: { backgroundColor: STITCH.primary },
  diaTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  diaTextoActivo: { color: STITCH.white },
  horarios: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  horario: { minWidth: "30%", borderWidth: 1.5, borderColor: STITCH.outlineVariant, borderRadius: 12, padding: 10,
    alignItems: "center", backgroundColor: STITCH.surfaceLowest },
  horarioHora: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 18 },
  horarioDetalle: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 11.5 },
  botonJarvis: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20,
    backgroundColor: STITCH.secondaryContainer, borderRadius: 999, paddingVertical: 14 },
  botonJarvisTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 15 },
});
