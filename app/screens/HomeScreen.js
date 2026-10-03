import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Alert,
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
import { useFocusEffect } from "@react-navigation/native";
import CarteraPuntos from "../components/CarteraPuntos";
import JarvisMini from "../components/JarvisMini";
import ProcedenciaSelector from "../components/ProcedenciaSelector";
import { actualizarProcedencia } from "../services/authService";
import Monedero from "../components/Monedero";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { useUserContext } from "../context/UserContext";
import { getDiversion } from "../services/diversionService";
import { getEmpresas } from "../services/directorioService";
import { getOfertas } from "../services/empresasService";
import { getMisPedidos } from "../services/pedidosService";
import { getMonedero } from "../services/puntosService";

// Atajos a las secciones de la app (los que no tienen pantalla propia le preguntan a Jarvis).
const CHIPS = [
  { icono: "restaurant-outline", texto: "Restaurantes", ruta: "Comer" },
  { icono: "bag-handle-outline", texto: "Tiendas", ruta: "Directorio", params: { filtro: "tiendas", titulo: "Tiendas" } },
  { icono: "flame-outline", texto: "Ofertas", ruta: "Directorio", params: { vista: "ofertas", titulo: "Ofertas" }, color: STITCH.oro },
  { icono: "briefcase-outline", texto: "Servicios", ruta: "Oficinas" },
];

const ACCESOS = [
  { icono: "restaurant", texto: "Comer", ruta: "Comer" },
  { icono: "bag-handle", texto: "Comprar", ruta: "Directorio", params: { filtro: "tiendas", titulo: "Tiendas" } },
  { icono: "pricetag", texto: "Promos", ruta: "Directorio", params: { vista: "ofertas", titulo: "Ofertas" }, hot: true },
  { icono: "map", texto: "Mapa", detalle: "Pisos PB-5", ruta: "Directorio", params: { vista: "pisos", titulo: "Por piso" } },
];

const EXPLORAR = [
  { icono: "restaurant", texto: "Restaurantes", ruta: "Comer" },
  { icono: "bag-handle-outline", texto: "Tiendas", ruta: "Directorio", params: { filtro: "tiendas", titulo: "Tiendas" } },
  { icono: "rocket-outline", texto: "Emprendimientos", ruta: "Directorio", params: { filtro: "emprendimientos", titulo: "Emprendimientos" } },
  { icono: "business-outline", texto: "Oficinas", ruta: "Oficinas" },
];

// Fondos para las tarjetas de promo mientras los negocios no suban su imagen.
const FONDOS_PROMO = ["#1b4965", "#5a4100", "#1c6586", "#7c2d12", "#3f3d8f"];
const ICONOS_PROMO = ["fast-food", "cafe", "headset", "gift", "pricetag"];

const TABS = [
  { icono: "home", texto: "Inicio", activo: true },
  { icono: "film-outline", texto: "Diversión", ruta: "Diversion" },
  { icono: "jarvis", texto: "Jarvis" },
  { icono: "scan-outline", texto: "Mi QR", ruta: "Escanear" },
  { icono: "star-outline", texto: "Beneficios", seccion: "monedas" },
];

const bs = (valor) => `Bs ${Number(valor).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;

export default function HomeScreen({ navigation }) {
  const { user, cerrarSesion, recargarPerfil } = useUserContext();
  const [monedero, setMonedero] = useState(null);
  const [errorMonedero, setErrorMonedero] = useState(null);
  const [ofertas, setOfertas] = useState([]);
  const [diversion, setDiversion] = useState(null);
  const [pedidosEnCurso, setPedidosEnCurso] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [refrescando, setRefrescando] = useState(false);
  // Clientes que se registraron antes de pedir la procedencia: se les pregunta una vez.
  const [procedencia, setProcedencia] = useState({ procedencia: "", ciudad_otra: "" });
  const [erroresProcedencia, setErroresProcedencia] = useState({});
  const [guardandoProcedencia, setGuardandoProcedencia] = useState(false);
  const faltaProcedencia = user?.rol === "CLIENTE" && !user?.procedencia;

  const guardarProcedencia = async () => {
    if (!procedencia.procedencia) return setErroresProcedencia({ procedencia: "Elige de dónde eres." });
    if (procedencia.procedencia === "OTRO" && !procedencia.ciudad_otra.trim()) {
      return setErroresProcedencia({ ciudad_otra: "Escribe tu ciudad." });
    }
    setGuardandoProcedencia(true);
    try {
      await actualizarProcedencia(procedencia);
      await recargarPerfil();
    } catch (err) {
      setErroresProcedencia({ ...(err.fieldErrors || {}), procedencia: err.fieldErrors?.procedencia || err.message });
    } finally {
      setGuardandoProcedencia(false);
    }
  };
  const scroll = useRef(null);
  const yPuntos = useRef(0);
  const nombre = user?.first_name || user?.username || "cliente";
  // La API manda las monedas con decimales como texto ("416.75").
  const saldo = Number(monedero?.saldo ?? user?.puntos_saldo ?? 0);
  const saldoTexto = saldo.toLocaleString("es-BO", { maximumFractionDigits: 2 });

  const cargarMonedero = useCallback(async () => {
    try {
      setMonedero(await getMonedero());
      setErrorMonedero(null);
    } catch (err) {
      // Las cuentas que no son de cliente (admin, portero…) no tienen monedero.
      setErrorMonedero(err.status === 403 ? "El monedero es solo para cuentas de cliente." : err.message);
    }
  }, []);

  const cargarOfertas = useCallback(async () => {
    try {
      setOfertas(await getOfertas());
    } catch {
      setOfertas([]);
    }
  }, []);

  const cargarDiversion = useCallback(async () => {
    try {
      setDiversion(await getDiversion());
    } catch {
      setDiversion(null);
    }
  }, []);

  // Al volver al Inicio (p. ej. desde Comer) se revisa si el negocio avanzó algún pedido.
  const cargarPedidos = useCallback(async () => {
    if (user?.rol !== "CLIENTE") return;
    try {
      const lista = await getMisPedidos();
      setPedidosEnCurso(lista.filter((p) => !["ENTREGADO", "CANCELADO"].includes(p.estado)));
    } catch {
      setPedidosEnCurso([]);
    }
  }, [user?.rol]);
  useFocusEffect(useCallback(() => { cargarPedidos(); }, [cargarPedidos]));

  // Restaurantes con foto real primero (portada de paseoaranjuez.com), después los que solo tienen logo.
  const cargarRestaurantes = useCallback(async () => {
    try {
      const lista = await getEmpresas({ tipo: "NEGOCIO", rubro: "comida" });
      setRestaurantes(lista.filter((e) => e.portada || e.logo).sort((a, b) => !!b.portada - !!a.portada));
    } catch {
      setRestaurantes([]);
    }
  }, []);

  useEffect(() => {
    cargarRestaurantes();
    cargarMonedero();
    cargarOfertas();
    cargarDiversion();
  }, [cargarMonedero, cargarOfertas, cargarDiversion]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await Promise.all([recargarPerfil(), cargarMonedero(), cargarOfertas(), cargarDiversion(), cargarPedidos(), cargarRestaurantes()]);
    setRefrescando(false);
  }, [recargarPerfil, cargarMonedero, cargarOfertas, cargarDiversion, cargarPedidos, cargarRestaurantes]);

  const preguntarAJarvis = (pregunta) => navigation.navigate("Asistente", { pregunta });
  const ir = (atajo) => (atajo.ruta ? navigation.navigate(atajo.ruta, atajo.params) : preguntarAJarvis(atajo.pregunta));
  const abrirModoVoz = () => navigation.navigate("Asistente", { modoVoz: true });

  const buscar = () => {
    const texto = busqueda.trim();
    if (!texto) return;
    setBusqueda("");
    preguntarAJarvis(texto);
  };

  const confirmarSalida = () =>
    Alert.alert("Cerrar sesión", "¿Quieres salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: cerrarSesion },
    ]);

  // Lo que Jarvis dice en sus globos, con datos reales del usuario.
  const mensajesJarvis = useMemo(() => {
    const lista = [`¡Hola, ${nombre}! ¿Qué buscas hoy?`];
    if (ofertas.length) lista.push(`Hoy hay ${ofertas.length} promos para ti 🔥`);
    if (!errorMonedero) lista.push(`Tienes ${saldoTexto} monedas 🪙`);
    const peliculas = diversion?.cartelera?.filter((p) => p.funciones.length).length;
    if (peliculas) lista.push(`Hay ${peliculas} películas en cartelera 🎬`);
    lista.push("Mantenme presionado y hablamos 🎤");
    return lista;
  }, [nombre, ofertas.length, saldoTexto, errorMonedero, diversion]);

  const irAMonedas = () => scroll.current?.scrollTo({ y: Math.max(0, yPuntos.current - 12), animated: true });

  const tocarTab = (tab) => {
    if (tab.icono === "jarvis") abrirModoVoz();
    else if (tab.ruta) navigation.navigate(tab.ruta);
    else if (tab.seccion === "monedas") irAMonedas();
    else if (!tab.activo) Alert.alert(tab.texto, "Esta sección estará disponible pronto.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View style={styles.marca}>
          <View style={styles.logo}>
            <Text style={styles.logoLetra}>PA</Text>
          </View>
          <View>
            <Text style={styles.marcaNombre}>PASEO ARANJUEZ</Text>
            <Text style={styles.marcaTitulo}>Inicio</Text>
          </View>
        </View>
        <View style={styles.headerAcciones}>
          {!errorMonedero ? (
            <CarteraPuntos saldo={saldo}
              onPress={irAMonedas} />
          ) : null}
          <TouchableOpacity style={styles.iconoHeader} accessibilityLabel="Notificaciones"
            onPress={() => Alert.alert("Notificaciones", "Pronto verás aquí tus avisos del Paseo.")}>
            <Ionicons name="notifications-outline" size={24} color={STITCH.onSurfaceVariant} />
            <View style={styles.puntoRojo} />
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmarSalida} style={styles.avatar} accessibilityLabel="Perfil y cerrar sesión">
            <Text style={styles.avatarLetra}>{nombre.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={STITCH.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Pedidos de Comer en curso (el negocio los avanza desde su panel web) */}
        {pedidosEnCurso.map((p) => {
          const listo = p.estado === "LISTO_PARA_RECOGER";
          return (
            <TouchableOpacity key={p.id} style={[styles.cine, listo && styles.pedidoListo]}
              onPress={() => navigation.navigate("Comer", { pestana: "pedidos" })}>
              <View style={[styles.cineIcono, { backgroundColor: listo ? "#166534" : STITCH.secondary }]}>
                <Ionicons name={listo ? "checkmark-done" : "time"} size={22} color={STITCH.white} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.cineTitulo}>{listo ? "¡Tu pedido está listo!" : `Pedido: ${p.estado_display}`}</Text>
                <Text style={styles.cineTexto} numberOfLines={1}>
                  {p.empresa_nombre} · código {p.codigo_retiro}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={STITCH.outline} />
            </TouchableOpacity>
          );
        })}

        {/* Saludo + Jarvis animado */}
        <View style={styles.saludoFila}>
          <View style={styles.saludoTexto}>
            <Text style={styles.hola}>Hola, {nombre}</Text>
            <Text style={styles.descubre}>Descubre algo nuevo en el Paseo</Text>
            <View style={styles.abierto}>
              <View style={styles.abiertoPunto} />
              <Text style={styles.abiertoTexto}>Abierto hoy</Text>
            </View>
          </View>
          <JarvisMini
            mensajes={mensajesJarvis}
            onPress={() => navigation.navigate("Asistente")}
            onLongPress={abrirModoVoz}
          />
        </View>

        {/* Buscador: la búsqueda se la pregunta a Jarvis */}
        <View style={styles.buscador}>
          <Ionicons name="search" size={20} color={STITCH.primary} />
          <TextInput
            style={styles.buscadorInput}
            value={busqueda}
            onChangeText={setBusqueda}
            onSubmitEditing={buscar}
            returnKeyType="search"
            placeholder="¿Qué estás buscando hoy?"
            placeholderTextColor={STITCH.outline}
          />
          <TouchableOpacity style={styles.buscadorBoton} onPress={buscar} accessibilityLabel="Preguntar a Jarvis">
            <Ionicons name="sparkles" size={18} color={STITCH.secondary} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHIPS.map((c) => (
            <TouchableOpacity key={c.texto} style={styles.chip} onPress={() => ir(c)}>
              <Ionicons name={c.icono} size={14} color={c.color || STITCH.secondary} />
              <Text style={styles.chipTexto}>{c.texto}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Accesos rápidos */}
        <View style={styles.accesos}>
          {ACCESOS.map((a) => (
            <TouchableOpacity key={a.texto} style={styles.acceso} onPress={() => ir(a)}>
              {a.hot ? <Text style={styles.hot}>HOT</Text> : null}
              <View style={styles.accesoIcono}>
                <Ionicons name={a.icono} size={22} color={STITCH.primary} />
              </View>
              <Text style={styles.accesoTexto}>{a.texto}</Text>
              {a.detalle ? <Text style={styles.accesoDetalle}>{a.detalle}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Concierge IA */}
        <View style={styles.concierge}>
          <View style={styles.conciergeDecoracion} />
          <View style={styles.conciergeEtiqueta}>
            <Ionicons name="sparkles" size={13} color={STITCH.oro} />
            <Text style={styles.conciergeEtiquetaTexto}>Concierge IA del Paseo</Text>
          </View>
          <Text style={styles.conciergeTitulo}>¿No sabes qué elegir?</Text>
          <Text style={styles.conciergeTexto}>
            Jarvis te recomienda gastronomía, compras y actividades en el Paseo en tiempo real.
          </Text>
          <View style={styles.conciergeBotones}>
            <TouchableOpacity style={styles.conciergeBoton} onPress={abrirModoVoz}>
              <Ionicons name="mic" size={18} color={STITCH.primary} />
              <Text style={styles.conciergeBotonTexto}>Hablar con Jarvis</Text>
              <Ionicons name="arrow-forward" size={18} color={STITCH.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.conciergeChat} onPress={() => navigation.navigate("Asistente")}
              accessibilityLabel="Escribirle a Jarvis">
              <Ionicons name="chatbubble-ellipses" size={20} color={STITCH.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Promociones */}
        <View style={styles.seccionFila}>
          <View>
            <Text style={styles.seccionTitulo}>Promociones para hoy</Text>
            <Text style={styles.seccionSub}>Válidas en el local del negocio</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Directorio", { vista: "ofertas", titulo: "Ofertas" })}>
            <Text style={styles.verTodas}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        {ofertas.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promos}>
            {ofertas.map((o, i) => {
              const normal = Number(o.precio_normal);
              const oferta = o.precio_oferta != null ? Number(o.precio_oferta) : null;
              const descuento = normal && oferta && normal > oferta ? Math.round((1 - oferta / normal) * 100) : null;
              return (
                <TouchableOpacity key={o.id} style={styles.promo} activeOpacity={0.85}
                  onPress={() => navigation.navigate("Empresa", { id: o.empresa_id })}>
                  <View style={[styles.promoImagen, { backgroundColor: FONDOS_PROMO[i % FONDOS_PROMO.length] }]}>
                    <Ionicons name={ICONOS_PROMO[i % ICONOS_PROMO.length]} size={54} color="rgba(255,255,255,0.85)" />
                    {descuento ? <Text style={styles.promoDescuento}>-{descuento}% OFF</Text> : null}
                  </View>
                  <View style={styles.promoCuerpo}>
                    <Text style={styles.promoLugar} numberOfLines={1}>
                      {o.empresa_nombre.toUpperCase()}{o.piso ? ` · PISO ${o.piso}` : ""}{o.local ? ` (LOCAL ${o.local})` : ""}
                    </Text>
                    <Text style={styles.promoTitulo} numberOfLines={2}>{o.titulo}</Text>
                    <View style={styles.promoPrecios}>
                      {oferta != null ? <Text style={styles.promoPrecio}>{bs(oferta)}</Text> : null}
                      {descuento ? <Text style={styles.promoPrecioNormal}>{bs(normal)}</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.vacio}>
            <Ionicons name="pricetags-outline" size={20} color={STITCH.outline} />
            <Text style={styles.vacioTexto}>Hoy no hay promociones publicadas.</Text>
          </View>
        )}

        {/* Restaurantes con sus fotos reales */}
        {restaurantes.length ? (
          <>
            <View style={styles.seccionFila}>
              <Text style={styles.seccionTitulo}>Para comer</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Comer")}>
                <Text style={styles.verTodas}>Ver menús</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.restaurantesFila}
              contentContainerStyle={styles.restaurantes}>
              {restaurantes.map((r) => (
                <TouchableOpacity key={r.id} style={styles.restaurante} activeOpacity={0.85}
                  onPress={() => navigation.navigate("Empresa", { id: r.id })}>
                  <Image source={{ uri: r.portada || r.logo }} style={styles.restauranteFoto}
                    resizeMode={r.portada ? "cover" : "contain"} />
                  <View style={styles.restauranteCuerpo}>
                    {r.logo ? <Image source={{ uri: r.logo }} style={styles.restauranteLogo} /> : null}
                    <View style={styles.flex1}>
                      <Text style={styles.restauranteNombre} numberOfLines={1}>{r.nombre}</Text>
                      <Text style={styles.restauranteMeta}>{r.piso === "PB" ? "Planta baja" : `Piso ${r.piso}`}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Evento destacado y cartelera */}
        {diversion?.destacado ? (
          <>
            <View style={styles.seccionFila}>
              <Text style={styles.seccionTitulo}>Evento destacado</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Diversion", { pestana: "eventos" })}>
                <Text style={styles.verTodas}>Ver eventos</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.evento} activeOpacity={0.9}
              onPress={() => navigation.navigate("Diversion", { pestana: "eventos" })}>
              <View style={styles.eventoDecoracion} />
              <View style={styles.eventoFila}>
                <Text style={styles.eventoCategoria}>{diversion.destacado.categoria_nombre.toUpperCase()}</Text>
                <Text style={styles.eventoPrecio}>
                  {diversion.destacado.gratis ? "Entrada libre" : `Bs ${diversion.destacado.precio}`}
                </Text>
              </View>
              <Text style={styles.eventoTitulo}>{diversion.destacado.titulo}</Text>
              <View style={styles.eventoFila}>
                <Text style={styles.eventoMeta}>
                  <Ionicons name="calendar-outline" size={13} color={STITCH.secondaryContainer} />{" "}
                  {new Date(diversion.destacado.inicio).toLocaleString("es-BO", {
                    weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                  {diversion.destacado.lugar ? ` · ${diversion.destacado.lugar}` : ""}
                </Text>
              </View>
              <View style={styles.eventoBoton}><Text style={styles.eventoBotonTexto}>Ver evento</Text></View>
            </TouchableOpacity>
          </>
        ) : null}
        {diversion?.cartelera?.some((p) => p.funciones.length) ? (
          <TouchableOpacity style={styles.cine} onPress={() => navigation.navigate("Diversion", { pestana: "cartelera" })}>
            <View style={styles.cineIcono}><Ionicons name="film" size={22} color={STITCH.white} /></View>
            <View style={styles.flex1}>
              <Text style={styles.cineTitulo}>Cartelera de cine</Text>
              <Text style={styles.cineTexto} numberOfLines={1}>
                {diversion.cartelera.filter((p) => p.funciones.length).map((p) => p.titulo).join(" · ")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={STITCH.outline} />
          </TouchableOpacity>
        ) : null}

        {/* Aranjuez Oficinas */}
        <TouchableOpacity style={styles.cine} onPress={() => navigation.navigate("Oficinas")}>
          <View style={[styles.cineIcono, { backgroundColor: STITCH.primaryContainer }]}>
            <Ionicons name="business" size={22} color={STITCH.white} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.cineTitulo}>Aranjuez Oficinas</Text>
            <Text style={styles.cineTexto} numberOfLines={1}>Conoce las oficinas y agenda tu visita con QR</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={STITCH.outline} />
        </TouchableOpacity>

        {/* Explora */}
        <Text style={[styles.seccionTitulo, styles.margenSeccion]}>Explora el Paseo</Text>
        <Text style={styles.seccionSub}>Comercio, oficinas y gastronomía en un solo lugar</Text>
        <View style={styles.explorar}>
          {EXPLORAR.map((e, i) => (
            <TouchableOpacity key={e.texto} style={[styles.explorarChip, i === 0 && styles.explorarChipActivo]}
              onPress={() => ir(e)}>
              <Ionicons name={e.icono} size={16} color={i === 0 ? STITCH.white : STITCH.primary} />
              <Text style={[styles.explorarTexto, i === 0 && styles.explorarTextoActivo]}>{e.texto}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Paseo Points */}
        <Text style={[styles.seccionTitulo, styles.margenSeccion]}
          onLayout={(e) => { yPuntos.current = e.nativeEvent.layout.y; }}>Tus monedas</Text>
        {errorMonedero ? (
          <View style={styles.vacio}>
            <Ionicons name="information-circle-outline" size={20} color={STITCH.outline} />
            <Text style={styles.vacioTexto}>{errorMonedero}</Text>
          </View>
        ) : (
          <View style={styles.monedero}>
            <Monedero datos={monedero ?? { saldo }} />
          </View>
        )}
      </ScrollView>

      <Modal visible={faltaProcedencia} transparent animationType="fade">
        <View style={styles.procFondo}>
          <View style={styles.procTarjeta}>
            <Text style={styles.procTitulo}>Un dato rápido</Text>
            <Text style={styles.procTexto}>Cuéntanos de dónde eres para mostrarte lo mejor del Paseo.</Text>
            <ProcedenciaSelector value={procedencia} onChange={setProcedencia} errores={erroresProcedencia} />
            <TouchableOpacity style={styles.procBoton} onPress={guardarProcedencia} disabled={guardandoProcedencia}>
              {guardandoProcedencia ? <ActivityIndicator color={STITCH.white} />
                : <Text style={styles.procBotonTexto}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barra inferior */}
      <SafeAreaView edges={["bottom"]} style={styles.tabs}>
        {TABS.map((tab) =>
          tab.icono === "jarvis" ? (
            <TouchableOpacity key={tab.texto} style={styles.tabJarvis} onPress={() => tocarTab(tab)}
              accessibilityLabel="Hablar con Jarvis">
              <View style={styles.tabJarvisBoton}>
                <Ionicons name="sparkles" size={26} color={STITCH.white} />
              </View>
              <Text style={styles.tabTexto}>Jarvis</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={tab.texto} style={styles.tab} onPress={() => tocarTab(tab)}>
              <Ionicons name={tab.icono} size={23} color={tab.activo ? STITCH.primary : STITCH.outline} />
              <Text style={[styles.tabTexto, tab.activo && styles.tabTextoActivo]}>{tab.texto}</Text>
            </TouchableOpacity>
          )
        )}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16,
    height: 68, backgroundColor: "rgba(247,249,255,0.95)", borderBottomWidth: 1, borderBottomColor: STITCH.surfaceHigh },
  marca: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: STITCH.primary, alignItems: "center",
    justifyContent: "center" },
  logoLetra: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 14 },
  marcaNombre: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 10, letterSpacing: 0.8 },
  marcaTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 19 },
  headerAcciones: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconoHeader: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  puntoRojo: { position: "absolute", top: 10, right: 9, width: 8, height: 8, borderRadius: 4,
    backgroundColor: STITCH.error },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: STITCH.secondaryContainer, alignItems: "center",
    justifyContent: "center", borderWidth: 2, borderColor: STITCH.outlineVariant },
  avatarLetra: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 15 },

  contenido: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  saludoFila: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", minHeight: 150,
    paddingTop: 50 },
  saludoTexto: { flex: 1, paddingBottom: 14 },
  hola: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 28, letterSpacing: -0.5 },
  descubre: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 15, marginTop: 2 },
  abierto: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10,
    backgroundColor: STITCH.surfaceHigh, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  abiertoPunto: { width: 8, height: 8, borderRadius: 4, backgroundColor: STITCH.secondary },
  abiertoTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 12 },

  buscador: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: STITCH.surfaceLowest,
    borderRadius: 14, paddingLeft: 14, paddingRight: 6, height: 52, marginTop: 14, ...SOMBRA },
  buscadorInput: { flex: 1, fontFamily: FUENTES.texto, fontSize: 15, color: STITCH.onSurface },
  buscadorBoton: { width: 38, height: 38, borderRadius: 10, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center" },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: STITCH.surfaceLow, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6 },
  chipTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 12.5 },

  accesos: { flexDirection: "row", gap: 10, marginTop: 6 },
  acceso: { flex: 1, alignItems: "center", backgroundColor: STITCH.surfaceLowest, borderRadius: 14, paddingVertical: 14,
    ...SOMBRA },
  accesoIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center", marginBottom: 6 },
  accesoTexto: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  accesoDetalle: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 10.5 },
  hot: { position: "absolute", top: -7, right: 6, zIndex: 2, backgroundColor: STITCH.oro, color: STITCH.oroOscuro,
    fontFamily: FUENTES.titulo, fontSize: 10, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
    overflow: "hidden" },

  concierge: { marginTop: 22, backgroundColor: STITCH.primary, borderRadius: 20, padding: 20, overflow: "hidden" },
  conciergeDecoracion: { position: "absolute", right: -40, top: -30, width: 180, height: 180, borderRadius: 90,
    borderWidth: 26, borderColor: "rgba(155,218,255,0.08)" },
  conciergeEtiqueta: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  conciergeEtiquetaTexto: { color: STITCH.secondaryContainer, fontFamily: FUENTES.textoFuerte, fontSize: 12 },
  conciergeTitulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 22, marginTop: 12 },
  conciergeTexto: { color: "#c9d6e0", fontFamily: FUENTES.texto, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  conciergeBotones: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  conciergeBoton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: STITCH.secondaryContainer,
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  conciergeBotonTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  conciergeChat: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center" },

  seccionFila: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26 },
  seccionTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  seccionSub: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5, marginTop: 2 },
  margenSeccion: { marginTop: 26 },
  verTodas: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },

  promos: { gap: 14, paddingVertical: 14, paddingRight: 20 },
  promo: { width: 250, backgroundColor: STITCH.surfaceLowest, borderRadius: 16, overflow: "hidden", ...SOMBRA },
  promoImagen: { height: 120, alignItems: "center", justifyContent: "center" },
  promoDescuento: { position: "absolute", top: 10, left: 10, backgroundColor: STITCH.oro, color: STITCH.oroOscuro,
    fontFamily: FUENTES.titulo, fontSize: 12, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    overflow: "hidden" },
  promoCuerpo: { padding: 12 },
  promoLugar: { color: STITCH.outline, fontFamily: FUENTES.textoFuerte, fontSize: 10.5, letterSpacing: 0.5 },
  promoTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 15, marginTop: 4, minHeight: 40 },
  promoPrecios: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 },
  promoPrecio: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  promoPrecioNormal: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 13, textDecorationLine: "line-through" },

  vacio: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: STITCH.surfaceLowest, borderRadius: 14,
    padding: 14, marginTop: 12 },
  vacioTexto: { flex: 1, color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },

  explorar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  explorarChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: STITCH.surfaceLowest,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, ...SOMBRA },
  explorarChipActivo: { backgroundColor: STITCH.primary },
  explorarTexto: { color: STITCH.onSurface, fontFamily: FUENTES.textoMedio, fontSize: 13.5 },
  explorarTextoActivo: { color: STITCH.white },

  monedero: { marginTop: 12 },
  procFondo: { flex: 1, backgroundColor: "rgba(0,20,35,0.55)", justifyContent: "center", padding: 20 },
  procTarjeta: { backgroundColor: STITCH.white, borderRadius: 20, padding: 20 },
  procTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  procTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, marginTop: 4, marginBottom: 14 },
  procBoton: { backgroundColor: STITCH.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  procBotonTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  flex1: { flex: 1 },

  evento: { marginTop: 12, backgroundColor: "#3f1d5c", borderRadius: 20, padding: 18, overflow: "hidden" },
  eventoDecoracion: { position: "absolute", right: -30, bottom: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(246,190,59,0.15)" },
  eventoFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventoCategoria: { color: STITCH.oro, fontFamily: FUENTES.titulo, fontSize: 11, letterSpacing: 0.6 },
  eventoPrecio: { color: STITCH.primary, backgroundColor: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 11.5,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
  eventoTitulo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 24, marginVertical: 8 },
  eventoMeta: { color: STITCH.secondaryContainer, fontFamily: FUENTES.textoMedio, fontSize: 13 },
  eventoBoton: { alignSelf: "flex-end", backgroundColor: STITCH.white, borderRadius: 999, paddingHorizontal: 16,
    paddingVertical: 9, marginTop: 12 },
  eventoBotonTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 14 },
  restaurantesFila: { flexGrow: 0, marginHorizontal: -20 },
  restaurantes: { gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
  restaurante: { width: 170, backgroundColor: STITCH.surfaceLowest, borderRadius: 16, overflow: "hidden", ...SOMBRA },
  restauranteFoto: { width: "100%", height: 110, backgroundColor: STITCH.surfaceLowest },
  restauranteCuerpo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  restauranteLogo: { width: 28, height: 28, borderRadius: 14 },
  restauranteNombre: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  restauranteMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 11.5 },
  pedidoListo: { borderWidth: 2, borderColor: "#166534" },
  cine: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, backgroundColor: STITCH.surfaceLowest,
    borderRadius: 16, padding: 14, ...SOMBRA },
  cineIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#7c2d12", alignItems: "center",
    justifyContent: "center" },
  cineTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  cineTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5 },

  tabs: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", backgroundColor: STITCH.surfaceLowest,
    borderTopWidth: 1, borderTopColor: STITCH.surfaceHigh, paddingTop: 8, paddingBottom: 6 },
  tab: { alignItems: "center", gap: 3, minWidth: 60, paddingBottom: 4 },
  tabTexto: { color: STITCH.outline, fontFamily: FUENTES.textoMedio, fontSize: 11.5 },
  tabTextoActivo: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte },
  tabJarvis: { alignItems: "center", gap: 3, marginTop: -26, paddingBottom: 4 },
  tabJarvisBoton: { width: 58, height: 58, borderRadius: 29, backgroundColor: STITCH.primaryContainer, alignItems: "center",
    justifyContent: "center", borderWidth: 4, borderColor: STITCH.surfaceLowest, ...SOMBRA, elevation: 6 },
});
