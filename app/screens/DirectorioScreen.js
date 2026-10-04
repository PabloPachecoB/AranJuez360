import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { getCategorias, getEmpresas } from "../services/directorioService";
import { getOfertas } from "../services/empresasService";

// Filtros rápidos (todos salen de los datos que cada empresa cargó en su panel).
const FILTROS = [
  { id: "todo", texto: "Todo", icono: "apps", query: { tipo: "NEGOCIO,EMPRENDIMIENTO" } },
  { id: "comer", texto: "Comer", icono: "restaurant", query: { tipo: "NEGOCIO,EMPRENDIMIENTO", rubro: "comida" } },
  { id: "tiendas", texto: "Tiendas", icono: "bag-handle", query: { tipo: "NEGOCIO", excluir_rubro: "comida" } },
  { id: "emprendimientos", texto: "Emprendimientos", icono: "rocket", query: { tipo: "EMPRENDIMIENTO" } },
];
const VISTAS = [
  { id: "lista", texto: "Lista", icono: "list" },
  { id: "pisos", texto: "Por piso", icono: "layers" },
  { id: "ofertas", texto: "Ofertas", icono: "flame" },
];
const ORDEN_PISOS = ["PB", "1", "2", "3", "4", "5"];

function Tarjeta({ empresa, onPress }) {
  return (
    <TouchableOpacity style={styles.tarjeta} onPress={onPress} activeOpacity={0.85}>
      {empresa.logo ? <Image source={{ uri: empresa.logo }} style={styles.logo} /> : (
        <View style={[styles.logo, styles.logoVacio]}>
          <Text style={styles.logoLetra}>{empresa.nombre.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.nombre} numberOfLines={1}>{empresa.nombre}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {empresa.tipo === "EMPRENDIMIENTO" ? "Emprendimiento · " : ""}{empresa.categoria_nombre || "Paseo Aranjuez"}
        </Text>
        {empresa.lema ? <Text style={styles.lema} numberOfLines={1}>{empresa.lema}</Text> : null}
        <View style={styles.fila}>
          <Text style={styles.ubicacion}>{empresa.piso ? `Piso ${empresa.piso}` : "Ubicación por confirmar"}{empresa.local ? ` · ${empresa.local}` : ""}</Text>
          {empresa.abierto_ahora != null ? (
            <Text style={[styles.estado, empresa.abierto_ahora ? styles.abierto : styles.cerrado]}>
              {empresa.abierto_ahora ? "Abierto" : "Cerrado"}
            </Text>
          ) : null}
          {empresa.ofertas_vigentes ? <Text style={styles.oferta}>🔥 {empresa.ofertas_vigentes}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={STITCH.outline} />
    </TouchableOpacity>
  );
}

export default function DirectorioScreen({ navigation, route }) {
  const inicial = route?.params || {};
  const [filtro, setFiltro] = useState(inicial.filtro || "todo");
  const [vista, setVista] = useState(inicial.vista || "lista");
  const [categoria, setCategoria] = useState(null);
  const [buscar, setBuscar] = useState(inicial.buscar || "");
  const [texto, setTexto] = useState(inicial.buscar || "");
  const [empresas, setEmpresas] = useState(null);
  const [ofertas, setOfertas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const query = useMemo(() => ({
    ...FILTROS.find((f) => f.id === filtro).query,
    ...(categoria ? { categoria } : {}),
    ...(buscar ? { buscar } : {}),
  }), [filtro, categoria, buscar]);

  const cargar = useCallback(async () => {
    try {
      setEmpresas(await getEmpresas(query));
      setError(null);
    } catch (err) {
      setError(err.message);
      setEmpresas([]);
    }
  }, [query]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {});
    getOfertas().then(setOfertas).catch(() => {});
  }, []);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([cargar(), getOfertas().then(setOfertas).catch(() => {})]);
    setRefrescando(false);
  };

  const pisos = useMemo(() => {
    const grupos = {};
    (empresas || []).forEach((e) => { (grupos[e.piso || "Sin piso"] ||= []).push(e); });
    return Object.entries(grupos).sort(([a], [b]) => {
      const ia = ORDEN_PISOS.indexOf(a); const ib = ORDEN_PISOS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [empresas]);

  const abrir = (id) => navigation.navigate("Empresa", { id });
  const titulo = inicial.titulo || "Directorio";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.sub}>Negocios y emprendimientos del Paseo</Text>
        </View>
      </View>

      <View style={styles.buscador}>
        <Ionicons name="search" size={18} color={STITCH.primary} />
        <TextInput style={styles.buscadorInput} value={texto} onChangeText={setTexto} returnKeyType="search"
          onSubmitEditing={() => setBuscar(texto.trim())} placeholder="Busca un negocio o producto"
          placeholderTextColor={STITCH.outline} />
        {texto ? (
          <TouchableOpacity onPress={() => { setTexto(""); setBuscar(""); }} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color={STITCH.outline} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.vistas}>
        {VISTAS.map((v) => (
          <TouchableOpacity key={v.id} onPress={() => setVista(v.id)} style={[styles.vista, vista === v.id && styles.vistaActiva]}>
            <Ionicons name={v.icono} size={15} color={vista === v.id ? STITCH.white : STITCH.primary} />
            <Text style={[styles.vistaTexto, vista === v.id && styles.vistaTextoActiva]}>{v.texto}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {vista !== "ofertas" ? (
        <>
          {/* Fila 1: qué quiero ver. Sin flexGrow:0 el ScrollView horizontal se aplasta a 0 de alto. */}
          <View style={styles.filtros}>
            {FILTROS.map((f) => {
              const activo = filtro === f.id && !categoria;
              return (
                <TouchableOpacity key={f.id} onPress={() => { setFiltro(f.id); setCategoria(null); }}
                  style={[styles.filtro, activo && styles.chipActivo]} accessibilityState={{ selected: activo }}>
                  <Ionicons name={f.icono} size={16} color={activo ? STITCH.white : STITCH.secondary} />
                  <Text style={[styles.filtroTexto, activo && styles.chipTextoActivo]} numberOfLines={1}>{f.texto}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Fila 2: rubros, en orden alfabético. */}
          {categorias.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsFila}
              contentContainerStyle={styles.chips}>
              {[...categorias].filter((c) => c.nombre !== "Comida").sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((c) => (
                <TouchableOpacity key={c.id} onPress={() => { setFiltro("todo"); setCategoria(categoria === c.id ? null : c.id); }}
                  style={[styles.chip, categoria === c.id && styles.chipActivo]}>
                  <Text style={[styles.chipTexto, categoria === c.id && styles.chipTextoActivo]}>{c.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      <ScrollView contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
        {error ? <Text style={styles.vacio}>{error}</Text> : null}

        {vista === "ofertas" ? (
          ofertas.length ? ofertas.map((o) => (
            <TouchableOpacity key={o.id} style={styles.ofertaTarjeta} onPress={() => abrir(o.empresa_id)}>
              {o.imagen ? (
                <Image source={{ uri: o.imagen }} style={styles.ofertaFoto} />
              ) : (
                <View style={styles.ofertaIcono}><Ionicons name="pricetag" size={20} color="#5a4100" /></View>
              )}
              <View style={styles.flex}>
                <Text style={styles.nombre}>{o.titulo}</Text>
                <Text style={styles.meta}>{o.empresa_nombre}{o.piso ? ` · Piso ${o.piso}` : ""}</Text>
                {o.precio_oferta ? <Text style={styles.precio}>Bs {Number(o.precio_oferta)}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={STITCH.outline} />
            </TouchableOpacity>
          )) : <Text style={styles.vacio}>Hoy no hay ofertas publicadas.</Text>
        ) : empresas === null ? (
          <ActivityIndicator color={STITCH.primary} style={{ marginTop: 40 }} />
        ) : !empresas.length ? (
          <Text style={styles.vacio}>{buscar ? `No encontramos “${buscar}”.` : "No hay negocios en esta categoría todavía."}</Text>
        ) : vista === "pisos" ? (
          pisos.map(([piso, lista]) => (
            <View key={piso}>
              <Text style={styles.piso}>{piso === "PB" ? "Planta baja" : piso === "Sin piso" ? "Sin piso asignado" : `Piso ${piso}`}</Text>
              {lista.map((e) => <Tarjeta key={e.id} empresa={e} onPress={() => abrir(e.id)} />)}
            </View>
          ))
        ) : (
          empresas.map((e) => <Tarjeta key={e.id} empresa={e} onPress={() => abrir(e.id)} />)
        )}
      </ScrollView>
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
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 14, height: 46,
    borderRadius: 14, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  buscadorInput: { flex: 1, fontFamily: FUENTES.texto, fontSize: 15, color: STITCH.onSurface },
  vistas: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  vista: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9,
    borderRadius: 999, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  vistaActiva: { backgroundColor: STITCH.primary },
  vistaTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  vistaTextoActiva: { color: STITCH.white },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  filtro: { flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12,
    paddingVertical: 9, borderRadius: 999, backgroundColor: STITCH.surfaceLow },
  filtroTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  chipsFila: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: STITCH.surfaceLowest, borderRadius: 999,
    borderWidth: 1, borderColor: STITCH.outlineVariant,
    paddingHorizontal: 12, paddingVertical: 7 },
  chipActivo: { backgroundColor: STITCH.secondary },
  chipTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 13 },
  chipTextoActivo: { color: STITCH.white },
  contenido: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  vacio: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, textAlign: "center", marginTop: 30 },
  piso: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 17, marginTop: 10, marginBottom: 6 },
  tarjeta: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    padding: 12, marginBottom: 10, ...SOMBRA },
  logo: { width: 56, height: 56, borderRadius: 14 },
  logoVacio: { backgroundColor: STITCH.primaryContainer, alignItems: "center", justifyContent: "center" },
  logoLetra: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 18 },
  nombre: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 16 },
  meta: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12.5, marginTop: 1 },
  lema: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5, marginTop: 1 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  ubicacion: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12 },
  estado: { fontFamily: FUENTES.textoFuerte, fontSize: 11, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  abierto: { backgroundColor: "#DCFCE7", color: "#166534" },
  cerrado: { backgroundColor: STITCH.surfaceHigh, color: STITCH.onSurfaceVariant },
  oferta: { fontFamily: FUENTES.textoFuerte, fontSize: 11.5, color: "#9a3412" },
  ofertaTarjeta: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    padding: 14, ...SOMBRA },
  ofertaFoto: { width: 72, height: 72, borderRadius: 14, backgroundColor: STITCH.surfaceHigh },
  ofertaIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.oro, alignItems: "center", justifyContent: "center" },
  precio: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 16, marginTop: 2 },
});
