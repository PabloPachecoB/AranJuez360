import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { precioVigente, useFlujoPedido } from "../components/FlujoPedido";
import { getEmpresa } from "../services/directorioService";
import { abrirBorradorJarvis } from "../services/jarvisNavigation";

const hhmm = (t) => (t || "").slice(0, 5);
const bs = (n) => `Bs ${Number(n).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;

function Contacto({ icono, texto, url }) {
  return (
    <TouchableOpacity style={styles.contacto} onPress={() => Linking.openURL(url).catch(() => {})}>
      <Ionicons name={icono} size={18} color={STITCH.primary} />
      <Text style={styles.contactoTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

/** Ficha pública de un negocio: portada, galería, horarios, contacto, ofertas y productos. */
export default function EmpresaScreen({ navigation, route }) {
  const { id } = route.params;
  const [empresa, setEmpresa] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [foto, setFoto] = useState(null);
  // Restaurantes: pedir y pagar desde la ficha (o reservar la hora de retiro).
  const flujo = useFlujoPedido({
    onPagoCerrado: (cerrado) => cerrado && navigation.navigate("Comer", { pestana: "pedidos" }),
  });

  const cargar = useCallback(async () => {
    try {
      setEmpresa(await getEmpresa(id));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  if (!empresa) {
    return (
      <SafeAreaView style={[styles.safe, styles.centro]}>
        {error ? <Text style={styles.vacio}>{error}</Text> : <ActivityIndicator color={STITCH.primary} />}
      </SafeAreaView>
    );
  }

  const e = empresa;
  const esComida = e.categoria_nombre === "Comida";
  // El carrito necesita saber de qué local es cada plato.
  const delLocal = (p) => ({ ...p, empresa: e.id, empresa_nombre: e.nombre, empresa_logo: e.logo, piso: e.piso, local: e.local });
  const contactos = [
    e.whatsapp && { icono: "logo-whatsapp", texto: "WhatsApp", url: `https://wa.me/591${e.whatsapp}` },
    e.telefono && { icono: "call", texto: "Llamar", url: `tel:${e.telefono}` },
    e.instagram && { icono: "logo-instagram", texto: "Instagram", url: e.instagram },
    e.facebook && { icono: "logo-facebook", texto: "Facebook", url: e.facebook },
    e.sitio_web && { icono: "globe-outline", texto: "Sitio web", url: e.sitio_web },
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.contenido, flujo.unidades ? { paddingBottom: 120 } : null]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
        <View>
          {e.portada ? <Image source={{ uri: e.portada }} style={styles.portada} /> : <View style={[styles.portada, styles.portadaVacia]} />}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.volver} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={22} color={STITCH.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.cabecera}>
          {e.logo ? <Image source={{ uri: e.logo }} style={styles.logo} /> : (
            <View style={[styles.logo, styles.logoVacio]}>
              <Text style={styles.logoLetra}>{e.nombre.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.nombre}>{e.nombre}</Text>
            <Text style={styles.meta}>
              {e.tipo === "EMPRENDIMIENTO" ? "Emprendimiento · " : ""}{e.categoria_nombre || "Paseo Aranjuez"}
            </Text>
            <View style={styles.fila}>
              <Text style={styles.ubicacion}>
                {e.piso ? (e.piso === "PB" ? "Planta baja" : `Piso ${e.piso}`) : "Ubicación por confirmar"}{e.local ? ` · ${e.local}` : ""}
              </Text>
              {e.abierto_ahora != null ? (
                <Text style={[styles.estado, e.abierto_ahora ? styles.abierto : styles.cerrado]}>
                  {e.abierto_ahora ? "Abierto" : "Cerrado"}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {e.lema ? <Text style={styles.lema}>{e.lema}</Text> : null}
        {e.descripcion ? <Text style={styles.texto}>{e.descripcion}</Text> : null}
        {e.referencia ? <Text style={styles.referencia}>📍 {e.referencia}</Text> : null}

        {contactos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactos}>
            {contactos.map((c) => <Contacto key={c.texto} {...c} />)}
          </ScrollView>
        ) : null}

        {e.fotos?.length ? (
          <>
            <Text style={styles.seccion}>Fotos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galeria}>
              {e.fotos.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => setFoto(f)} activeOpacity={0.85}>
                  <Image source={{ uri: f.imagen }} style={styles.foto} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {e.ofertas?.length ? (
          <>
            <Text style={styles.seccion}>Ofertas de hoy</Text>
            {e.ofertas.map((o) => (
              <View key={o.id} style={styles.item}>
                <Ionicons name="pricetag" size={18} color={STITCH.oroOscuro} />
                <View style={styles.flex}>
                  <Text style={styles.itemTitulo}>{o.titulo}</Text>
                  {o.descripcion ? <Text style={styles.itemTexto}>{o.descripcion}</Text> : null}
                </View>
                {o.precio_oferta ? <Text style={styles.precio}>{bs(o.precio_oferta)}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {e.horarios?.length ? (
          <>
            <Text style={styles.seccion}>Horarios</Text>
            <View style={styles.tarjeta}>
              {e.horarios.map((h) => (
                <View key={h.dia} style={styles.horario}>
                  <Text style={styles.itemTexto}>{h.dia_nombre}</Text>
                  <Text style={styles.itemTitulo}>{h.cerrado || !h.abre ? "Cerrado" : `${hhmm(h.abre)} – ${hhmm(h.cierra)}`}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {e.productos?.length ? (
          <>
            <Text style={styles.seccion}>{esComida ? "Menú" : "Productos"}</Text>
            {esComida ? (
              <View style={styles.avisoPedido}>
                <Ionicons name="bag-handle-outline" size={18} color={STITCH.secondary} />
                <Text style={styles.avisoPedidoTexto}>
                  Agrega platos con +, págalos con QR y retíralos aquí: ahora o a la hora que reserves.
                </Text>
              </View>
            ) : null}
            {e.productos.map((p) => {
              const cantidad = flujo.cantidadDe(p.id);
              return (
                <View key={p.id} style={styles.item}>
                  {p.foto ? <Image source={{ uri: p.foto }} style={styles.productoFoto} /> : null}
                  <View style={styles.flex}>
                    <Text style={styles.itemTitulo}>{p.nombre}</Text>
                    {p.descripcion ? <Text style={styles.itemTexto} numberOfLines={2}>{p.descripcion}</Text> : null}
                    <Text style={styles.precio}>{bs(precioVigente(p))}</Text>
                  </View>
                  {esComida ? (
                    cantidad ? (
                      <View style={styles.stepper}>
                        <TouchableOpacity onPress={() => flujo.cambiar(delLocal(p), -1)} accessibilityLabel={`Quitar un ${p.nombre}`}>
                          <Ionicons name="remove-circle" size={28} color={STITCH.primary} />
                        </TouchableOpacity>
                        <Text style={styles.cantidad}>{cantidad}</Text>
                        <TouchableOpacity onPress={() => flujo.cambiar(delLocal(p), 1)} accessibilityLabel={`Agregar un ${p.nombre}`}>
                          <Ionicons name="add-circle" size={28} color={STITCH.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => flujo.cambiar(delLocal(p), 1)} accessibilityLabel={`Agregar ${p.nombre}`}>
                        <Ionicons name="add-circle" size={32} color={STITCH.secondary} />
                      </TouchableOpacity>
                    )
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {esComida ? (
          <TouchableOpacity style={[styles.jarvis, styles.pedir]} onPress={() => navigation.navigate("Comer", { pestana: "pedidos" })}>
            <Ionicons name="receipt" size={18} color={STITCH.primary} />
            <Text style={[styles.jarvisTexto, styles.pedirTexto]}>Ver mis pedidos</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.jarvis}
          onPress={() => abrirBorradorJarvis(navigation, { pregunta: `Cuéntame de ${e.nombre} y cómo llego` })}>
          <Ionicons name="sparkles" size={18} color={STITCH.white} />
          <Text style={styles.jarvisTexto}>Preguntar a Jarvis</Text>
        </TouchableOpacity>
      </ScrollView>

      {flujo.elementos}

      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setFoto(null)}>
        <TouchableOpacity style={styles.visor} activeOpacity={1} onPress={() => setFoto(null)}>
          {foto ? <Image source={{ uri: foto.imagen }} style={styles.visorFoto} resizeMode="contain" /> : null}
          {foto?.titulo ? <Text style={styles.visorTitulo}>{foto.titulo}</Text> : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.surface },
  centro: { alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  contenido: { paddingBottom: 40 },
  portada: { width: "100%", height: 190 },
  portadaVacia: { backgroundColor: STITCH.primaryContainer },
  volver: { position: "absolute", top: 12, left: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 999, padding: 8, ...SOMBRA },
  cabecera: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 16, marginTop: -32 },
  logo: { width: 76, height: 76, borderRadius: 18, borderWidth: 3, borderColor: STITCH.surfaceLowest, backgroundColor: STITCH.surfaceLowest },
  logoVacio: { backgroundColor: STITCH.primaryContainer, alignItems: "center", justifyContent: "center" },
  logoLetra: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 22 },
  nombre: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22 },
  meta: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" },
  ubicacion: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12.5 },
  estado: { fontFamily: FUENTES.textoFuerte, fontSize: 11, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  abierto: { backgroundColor: "#DCFCE7", color: "#166534" },
  cerrado: { backgroundColor: STITCH.surfaceHigh, color: STITCH.onSurfaceVariant },
  lema: { color: STITCH.onSurface, fontFamily: FUENTES.textoMedio, fontSize: 15, marginHorizontal: 16, marginTop: 14 },
  texto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, marginHorizontal: 16, marginTop: 6, lineHeight: 20 },
  referencia: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13, marginHorizontal: 16, marginTop: 6 },
  contactos: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  contacto: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: STITCH.surfaceLowest, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9, ...SOMBRA },
  contactoTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  seccion: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 18, marginHorizontal: 16, marginTop: 22, marginBottom: 10 },
  galeria: { gap: 10, paddingHorizontal: 16 },
  foto: { width: 150, height: 150, borderRadius: 14, backgroundColor: STITCH.surfaceHigh },
  tarjeta: { backgroundColor: STITCH.surfaceLowest, borderRadius: 16, marginHorizontal: 16, padding: 14, gap: 6, ...SOMBRA },
  horario: { flexDirection: "row", justifyContent: "space-between" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16,
    marginHorizontal: 16, marginBottom: 10, padding: 12, ...SOMBRA },
  itemTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 14 },
  itemTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  productoFoto: { width: 48, height: 48, borderRadius: 10 },
  precio: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 15 },
  vacio: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, textAlign: "center", margin: 30 },
  jarvis: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: STITCH.primary,
    borderRadius: 999, marginHorizontal: 16, marginTop: 24, paddingVertical: 14 },
  jarvisTexto: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 15 },
  pedir: { backgroundColor: STITCH.oro },
  avisoPedido: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: STITCH.surfaceLow, borderRadius: 12,
    padding: 10, marginBottom: 8 },
  avisoPedidoTexto: { flex: 1, color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  cantidad: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 16, minWidth: 16, textAlign: "center" },
  pedirTexto: { color: STITCH.primary },
  visor: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  visorFoto: { width: "100%", height: "80%" },
  visorTitulo: { color: "#fff", fontFamily: FUENTES.texto, fontSize: 14, marginTop: 12 },
});
