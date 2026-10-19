import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { bs, pisoTexto } from "../components/CarritoSheet";
import { precioVigente, useFlujoPedido } from "../components/FlujoPedido";
import { FINALES, TarjetaPedido } from "../components/PedidoComer";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { getMisPedidos, getProductos } from "../services/pedidosService";
// El negocio cambia el estado desde su panel web; mientras haya pedidos en curso se consulta seguido.
const REFRESCO_MS = 5000;

/** PaseoYa · Comer: menú, carrito por local, pago con QR y seguimiento hasta el retiro en el local. */
export default function ComerScreen({ navigation, route }) {
  const inicial = route?.params || {};
  const [pestana, setPestana] = useState(inicial.pestana || "menu");
  const [productos, setProductos] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(inicial.empresa || null);
  const [texto, setTexto] = useState("");
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setProductos(await getProductos({ rubro: "comida" }));
      setError(null);
    } catch (err) {
      setError(err.message);
      setProductos([]);
    }
  }, []);

  const cargarPedidos = useCallback(async () => {
    try {
      setPedidos(await getMisPedidos());
    } catch (err) {
      setPedidos([]);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (pestana === "pedidos") cargarPedidos();
  }, [pestana, cargarPedidos]);

  const hayEnCurso = (pedidos || []).some((pd) => !FINALES.includes(pd.estado));
  useEffect(() => {
    if (pestana !== "pedidos" || !hayEnCurso) return undefined;
    const timer = setInterval(cargarPedidos, REFRESCO_MS);
    return () => clearInterval(timer);
  }, [pestana, hayEnCurso, cargarPedidos]);

  const refrescar = async () => {
    setRefrescando(true);
    await (pestana === "menu" ? cargar() : cargarPedidos());
    setRefrescando(false);
  };

  // Locales con menú, en orden alfabético, para el carrusel de logos.
  const locales = useMemo(() => {
    const vistos = new Map();
    (productos || []).forEach((p) => {
      if (!vistos.has(p.empresa)) vistos.set(p.empresa, { id: p.empresa, nombre: p.empresa_nombre, logo: p.empresa_logo });
    });
    return [...vistos.values()];
  }, [productos]);

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return (productos || []).filter((p) => (!local || p.empresa === local)
      && (!q || `${p.nombre} ${p.descripcion} ${p.seccion} ${p.empresa_nombre}`.toLowerCase().includes(q)))
      .sort((a, b) => !!b.foto - !!a.foto); // primero los platos con foto real del local
  }, [productos, local, texto]);

  // Carrito → reservar u ordenar ya → pago con QR (compartido con la ficha del restaurante).
  const flujo = useFlujoPedido({
    mostrarBarra: pestana === "menu",
    onPagoCerrado: (cerrado) => {
      cargarPedidos();
      if (cerrado) setPestana("pedidos");
    },
  });
  const cambiar = flujo.cambiar;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Comer</Text>
          <Text style={styles.sub}>Pide desde la app y recoge en el local</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.pestanas}>
        {[{ id: "menu", texto: "Menú", icono: "restaurant" }, { id: "pedidos", texto: "Mis pedidos", icono: "receipt" }].map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setPestana(p.id)} style={[styles.pestana, pestana === p.id && styles.pestanaActiva]}>
            <Ionicons name={p.icono} size={15} color={pestana === p.id ? STITCH.white : STITCH.primary} />
            <Text style={[styles.pestanaTexto, pestana === p.id && styles.pestanaTextoActiva]}>{p.texto}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pestana === "menu" ? (
        <>
          <View style={styles.buscador}>
            <Ionicons name="search" size={18} color={STITCH.primary} />
            <TextInput style={styles.buscadorInput} value={texto} onChangeText={setTexto}
              placeholder="Pizza, helado, pique…" placeholderTextColor={STITCH.outline} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.localesFila} contentContainerStyle={styles.locales}>
            <TouchableOpacity style={styles.localItem} onPress={() => setLocal(null)}>
              <View style={[styles.localLogo, styles.localTodos, !local && styles.localActivo]}>
                <Ionicons name="grid" size={22} color={STITCH.white} />
              </View>
              <Text style={styles.localNombre} numberOfLines={1}>Todos</Text>
            </TouchableOpacity>
            {locales.map((l) => (
              <TouchableOpacity key={l.id} style={styles.localItem} onPress={() => setLocal(local === l.id ? null : l.id)}>
                {l.logo ? <Image source={{ uri: l.logo }} style={[styles.localLogo, local === l.id && styles.localActivo]} /> : (
                  <View style={[styles.localLogo, styles.localTodos, local === l.id && styles.localActivo]}>
                    <Text style={styles.localLetra}>{l.nombre.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.localNombre} numberOfLines={1}>{l.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      <ScrollView contentContainerStyle={[styles.contenido, flujo.unidades ? { paddingBottom: 110 } : null]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
        {error ? <Text style={styles.vacio}>{error}</Text> : null}

        {pestana === "menu" ? (
          productos === null ? <ActivityIndicator color={STITCH.primary} style={{ marginTop: 40 }} />
          : !visibles.length ? <Text style={styles.vacio}>No encontramos platos con ese filtro.</Text>
          : (
            <View style={styles.grilla}>
              {visibles.map((p) => (
                <View key={p.id} style={styles.plato}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Empresa", { id: p.empresa })}>
                    {p.foto || p.empresa_logo ? (
                      <Image source={{ uri: p.foto || p.empresa_logo }} style={[styles.platoFoto, !p.foto && styles.platoLogo]}
                        resizeMode={p.foto ? "cover" : "contain"} />
                    ) : (
                      <View style={[styles.platoFoto, styles.localTodos]}>
                        <Ionicons name="restaurant" size={32} color={STITCH.oro} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.platoCuerpo}>
                    <Text style={styles.platoNombre} numberOfLines={2}>{p.nombre}</Text>
                    <Text style={styles.platoLocal} numberOfLines={1}>{p.empresa_nombre} · {pisoTexto(p.piso)}</Text>
                    <View style={styles.platoFila}>
                      <Text style={styles.precio}>{bs(precioVigente(p))}</Text>
                      {flujo.cantidadDe(p.id) ? (
                        <View style={styles.stepper}>
                          <TouchableOpacity onPress={() => cambiar(p, -1)} accessibilityLabel="Quitar uno">
                            <Ionicons name="remove-circle" size={26} color={STITCH.primary} />
                          </TouchableOpacity>
                          <Text style={styles.cantidad}>{flujo.cantidadDe(p.id)}</Text>
                          <TouchableOpacity onPress={() => cambiar(p, 1)} accessibilityLabel="Agregar uno">
                            <Ionicons name="add-circle" size={26} color={STITCH.primary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => cambiar(p, 1)} accessibilityLabel={`Agregar ${p.nombre}`}>
                          <Ionicons name="add-circle" size={30} color={STITCH.secondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : pedidos === null ? <ActivityIndicator color={STITCH.primary} style={{ marginTop: 40 }} />
          : !pedidos.length ? <Text style={styles.vacio}>Todavía no hiciste pedidos.</Text>
          : pedidos.map((pd) => (
            <TarjetaPedido key={pd.id} pedido={pd} onPagar={flujo.pagar} onCambio={cargarPedidos} />
          ))}
      </ScrollView>

      {flujo.elementos}
      </KeyboardAvoidingView>
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
  pestanas: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  pestana: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9,
    borderRadius: 999, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  pestanaActiva: { backgroundColor: STITCH.primary },
  pestanaTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  pestanaTextoActiva: { color: STITCH.white },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14,
    height: 44, borderRadius: 14, backgroundColor: STITCH.surfaceLowest, ...SOMBRA },
  buscadorInput: { flex: 1, fontFamily: FUENTES.texto, fontSize: 15, color: STITCH.onSurface },
  localesFila: { flexGrow: 0, flexShrink: 0 },
  locales: { gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  localItem: { width: 64, alignItems: "center", gap: 4 },
  localLogo: { width: 56, height: 56, borderRadius: 28, backgroundColor: STITCH.surfaceLowest, borderWidth: 2, borderColor: "transparent" },
  localTodos: { backgroundColor: STITCH.primaryContainer, alignItems: "center", justifyContent: "center" },
  localActivo: { borderColor: STITCH.oro },
  localLetra: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 16 },
  localNombre: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 11, textAlign: "center" },
  contenido: { paddingHorizontal: 16, paddingBottom: 40 },
  vacio: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, textAlign: "center", marginTop: 30 },
  grilla: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  plato: { width: "48.5%", backgroundColor: STITCH.surfaceLowest, borderRadius: 16, overflow: "hidden", ...SOMBRA },
  platoFoto: { width: "100%", aspectRatio: 1.2, backgroundColor: STITCH.surfaceHigh },
  platoLogo: { backgroundColor: STITCH.surfaceLowest },
  platoCuerpo: { padding: 10, gap: 2 },
  platoNombre: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 14 },
  platoLocal: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12 },
  platoFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  precio: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 15 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  cantidad: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 14, minWidth: 16, textAlign: "center" },
  pedido: { backgroundColor: STITCH.surfaceLowest, borderRadius: 16, padding: 14, marginBottom: 10, gap: 2, ...SOMBRA },
  estado: { fontFamily: FUENTES.textoFuerte, fontSize: 12 },
  codigoChico: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13, letterSpacing: 1 },
  barraCarrito: { position: "absolute", left: 16, right: 16, bottom: 24, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: STITCH.primary, borderRadius: 18, padding: 14, ...SOMBRA },
  barraTitulo: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
  barraSub: { color: "rgba(255,255,255,0.8)", fontFamily: FUENTES.texto, fontSize: 12 },
  bolsa: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.oro, alignItems: "center", justifyContent: "center" },
  bolsaNumero: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, overflow: "hidden",
    backgroundColor: STITCH.white, color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 12, textAlign: "center",
    lineHeight: 20, paddingHorizontal: 4 },
  botonPedir: { backgroundColor: STITCH.oro, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: "center" },
  botonPedirTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: STITCH.surfaceLowest, borderRadius: 20, padding: 24, alignItems: "center", gap: 8, width: "100%",
    maxWidth: 420 },
  modalTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22 },
  modalTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center" },
  codigo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 32, letterSpacing: 4, marginVertical: 8 },
  modalBoton: { backgroundColor: STITCH.primary, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  modalBotonTexto: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
});
