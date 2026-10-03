import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { crearPedido, getMisPedidos, getProductos } from "../services/pedidosService";

const bs = (n) => `Bs ${Number(n).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
const pisoTexto = (piso) => (piso === "PB" ? "Planta baja" : piso ? `Piso ${piso}` : "");
// El negocio cambia el estado desde su panel web; mientras haya pedidos en curso se consulta seguido.
const REFRESCO_MS = 15000;
const FINALES = ["ENTREGADO", "CANCELADO"];
const COLOR_ESTADO = {
  RECIBIDO: "#1c6586", CONFIRMADO: "#1c6586", PREPARANDO: "#8A5A00",
  LISTO_PARA_RECOGER: "#166534", ENTREGADO: "#64748b", CANCELADO: "#b91c1c",
};

/** PaseoYa · Comer: menú de los restaurantes con fotos, carrito por local y pedido para recoger. */
export default function ComerScreen({ navigation, route }) {
  const inicial = route?.params || {};
  const [pestana, setPestana] = useState(inicial.pestana || "menu");
  const [productos, setProductos] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(inicial.empresa || null);
  const [texto, setTexto] = useState("");
  const [carrito, setCarrito] = useState({}); // { productoId: cantidad }
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
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

  const enCarrito = useMemo(
    () => (productos || []).filter((p) => carrito[p.id]).map((p) => ({ ...p, cantidad: carrito[p.id] })),
    [productos, carrito],
  );
  const total = enCarrito.reduce((suma, p) => suma + Number(p.precio) * p.cantidad, 0);
  const unidades = enCarrito.reduce((suma, p) => suma + p.cantidad, 0);

  const cambiar = (producto, delta) => {
    const otroLocal = enCarrito.find((p) => p.empresa !== producto.empresa);
    if (delta > 0 && otroLocal) {
      Alert.alert(
        "Un pedido por local",
        `Tu carrito tiene productos de ${otroLocal.empresa_nombre}. ¿Lo vacías para pedir en ${producto.empresa_nombre}?`,
        [{ text: "Cancelar", style: "cancel" }, { text: "Vaciar", onPress: () => setCarrito({ [producto.id]: 1 }) }],
      );
      return;
    }
    setCarrito((prev) => {
      const cantidad = (prev[producto.id] || 0) + delta;
      const siguiente = { ...prev };
      if (cantidad > 0) siguiente[producto.id] = cantidad;
      else delete siguiente[producto.id];
      return siguiente;
    });
  };

  const pedir = () => {
    const empresa = enCarrito[0];
    Alert.alert("Confirmar pedido", `${unidades} producto(s) de ${empresa.empresa_nombre} por ${bs(total)}. Lo recoges en el local.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Pedir",
        onPress: async () => {
          setEnviando(true);
          try {
            const pedido = await crearPedido(empresa.empresa,
              enCarrito.map((p) => ({ producto_id: p.id, cantidad: p.cantidad })));
            setCarrito({});
            setConfirmado({ ...pedido, piso: empresa.piso, local: empresa.local });
          } catch (err) {
            Alert.alert("No se pudo hacer el pedido", err.message);
          } finally {
            setEnviando(false);
          }
        },
      },
    ]);
  };

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

      <ScrollView contentContainerStyle={[styles.contenido, unidades ? { paddingBottom: 110 } : null]}
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
                      <Text style={styles.precio}>{bs(p.precio)}</Text>
                      {carrito[p.id] ? (
                        <View style={styles.stepper}>
                          <TouchableOpacity onPress={() => cambiar(p, -1)} accessibilityLabel="Quitar uno">
                            <Ionicons name="remove-circle" size={26} color={STITCH.primary} />
                          </TouchableOpacity>
                          <Text style={styles.cantidad}>{carrito[p.id]}</Text>
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
            <View key={pd.id} style={styles.pedido}>
              <View style={styles.platoFila}>
                <Text style={styles.platoNombre}>{pd.empresa_nombre}</Text>
                <Text style={[styles.estado, { color: COLOR_ESTADO[pd.estado] }]}>{pd.estado_display}</Text>
              </View>
              {pd.items.map((it) => (
                <Text key={it.id} style={styles.platoLocal}>{it.cantidad} × {it.producto_nombre}</Text>
              ))}
              <View style={styles.platoFila}>
                <Text style={styles.precio}>{bs(pd.total)}</Text>
                {!FINALES.includes(pd.estado) ? (
                  <Text style={styles.codigoChico} selectable>Código {pd.codigo_retiro}</Text>
                ) : null}
              </View>
            </View>
          ))}
      </ScrollView>

      {pestana === "menu" && unidades ? (
        <View style={styles.barraCarrito}>
          <View style={styles.flex}>
            <Text style={styles.barraTitulo}>{unidades} en tu pedido · {bs(total)}</Text>
            <Text style={styles.barraSub} numberOfLines={1}>{enCarrito[0].empresa_nombre} · retiro en el local</Text>
          </View>
          <TouchableOpacity style={styles.botonPedir} onPress={pedir} disabled={enviando}>
            {enviando ? <ActivityIndicator color={STITCH.primary} /> : <Text style={styles.botonPedirTexto}>Pedir</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={!!confirmado} transparent animationType="fade" onRequestClose={() => setConfirmado(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modal}>
            <Ionicons name="checkmark-circle" size={48} color="#166534" />
            <Text style={styles.modalTitulo}>¡Pedido enviado!</Text>
            <Text style={styles.modalTexto}>
              Recógelo en {confirmado?.empresa_nombre}{confirmado?.piso ? `, ${pisoTexto(confirmado.piso).toLowerCase()}` : ""}.
              Muestra este código al retirar:
            </Text>
            <Text style={styles.codigo} selectable>{confirmado?.codigo_retiro}</Text>
            <TouchableOpacity style={styles.modalBoton} onPress={() => { setConfirmado(null); setPestana("pedidos"); }}>
              <Text style={styles.modalBotonTexto}>Ver mis pedidos</Text>
            </TouchableOpacity>
          </View>
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
  botonPedir: { backgroundColor: STITCH.oro, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, minWidth: 80, alignItems: "center" },
  botonPedirTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: STITCH.surfaceLowest, borderRadius: 20, padding: 24, alignItems: "center", gap: 8, width: "100%" },
  modalTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22 },
  modalTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center" },
  codigo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 32, letterSpacing: 4, marginVertical: 8 },
  modalBoton: { backgroundColor: STITCH.primary, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  modalBotonTexto: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
});
