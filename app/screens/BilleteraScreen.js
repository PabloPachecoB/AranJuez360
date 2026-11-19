import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useUserContext } from "../context/UserContext";
import { autenticarConBiometria, biometriaDisponible } from "../services/biometria";
import { getEmpresas } from "../services/directorioService";
import {
  CAMPANIA,
  adelantarDias,
  ahora,
  anularLote,
  bs,
  calcularDevolucion,
  estadoInicial,
  estadoLote,
  getCotizaciones,
  pagar,
  previsualizarPago,
  registrarCompra,
  resumen,
  usd,
  usdABs,
} from "../services/billeteraSimulada";

// La simulación vive mientras la app esté abierta (no se guarda en el servidor).
let memoria = estadoInicial();

const ESTADOS_LOTE = {
  PENDIENTE: { texto: "Pendiente", color: "#B7791F", fondo: "#FFF4CC" },
  DISPONIBLE: { texto: "Disponible", color: "#166534", fondo: "#DCFCE7" },
  VENCIDO: { texto: "Venció", color: STITCH.outline, fondo: STITCH.surfaceHigh },
  AGOTADO: { texto: "Usado", color: STITCH.outline, fondo: STITCH.surfaceHigh },
  ANULADO: { texto: "Anulado", color: STITCH.error, fondo: "#FDE2E2" },
};

const MOVIMIENTOS = {
  DEVOLUCION: { icono: "gift", color: "#166534" },
  PAGO: { icono: "card", color: STITCH.primary },
  VENCIMIENTO: { icono: "hourglass", color: STITCH.outline },
  ANULACION: { icono: "return-up-back", color: STITCH.error },
};

const fecha = (ms) => new Date(ms).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });
const hora = (ms) => new Date(ms).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const pisoTexto = (p) => (p === "PB" ? "Planta baja" : p ? `Piso ${p}` : "");
const esComida = (e) => /comida/i.test(e.categoria_nombre || "");

async function confirmarConHuella() {
  if (!(await biometriaDisponible())) return true; // sin huella configurada (o en web) no se bloquea la demo
  try {
    return await autenticarConBiometria("Confirma el pago con tu billetera");
  } catch {
    return true;
  }
}

/** Lista de negocios reales del Paseo con buscador, para elegir dónde compra o paga. */
function SelectorEmpresa({ empresas, valor, onElegir, excluirId, soloComida }) {
  const [buscar, setBuscar] = useState("");
  const lista = empresas
    .filter((e) => e.id !== excluirId && (!soloComida || esComida(e)))
    .filter((e) => e.nombre.toLowerCase().includes(buscar.trim().toLowerCase()));
  return (
    <View>
      <View style={styles.buscador}>
        <Ionicons name="search" size={16} color={STITCH.outline} />
        <TextInput style={styles.buscadorInput} value={buscar} onChangeText={setBuscar}
          placeholder="Buscar negocio" placeholderTextColor={STITCH.outline} />
      </View>
      <ScrollView style={styles.selector} nestedScrollEnabled>
        {lista.map((e) => (
          <TouchableOpacity key={e.id} style={[styles.opcion, valor?.id === e.id && styles.opcionActiva]}
            onPress={() => onElegir(e)}>
            {e.logo ? <Image source={{ uri: e.logo }} style={styles.opcionLogo} /> : (
              <View style={[styles.opcionLogo, styles.opcionLogoVacio]}><Ionicons name="storefront" size={14} color={STITCH.outline} /></View>
            )}
            <View style={styles.flex1}>
              <Text style={styles.opcionNombre} numberOfLines={1}>{e.nombre}</Text>
              <Text style={styles.opcionMeta} numberOfLines={1}>
                {[e.categoria_nombre, pisoTexto(e.piso)].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {valor?.id === e.id ? <Ionicons name="checkmark-circle" size={20} color={STITCH.secondary} /> : null}
          </TouchableOpacity>
        ))}
        {!lista.length ? <Text style={styles.nota}>No hay negocios con ese nombre.</Text> : null}
      </ScrollView>
    </View>
  );
}

function Hoja({ visible, titulo, onCerrar, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={styles.hojaFondo} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hoja}>
          <View style={styles.hojaCabecera}>
            <Text style={styles.hojaTitulo}>{titulo}</Text>
            <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={STITCH.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Billetera Paseo — simulación del frontend que tendrá la app: saldo de regalo en USD,
 * mostrado en Bs con la cotización del día, que se gana por compras y se gasta en otros negocios del Paseo.
 */
export default function BilleteraScreen({ navigation }) {
  const { user } = useUserContext();
  const [estado, setEstadoLocal] = useState(memoria);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cotizacionId, setCotizacionId] = useState("oficial");
  const [cargandoCot, setCargandoCot] = useState(true);
  const [errorCot, setErrorCot] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hoja, setHoja] = useState(null); // "compra" | "pago" | "como"
  const [empresa, setEmpresa] = useState(null);
  const [monto, setMonto] = useState("");
  const [origen, setOrigen] = useState("Caja del local");
  const [pagando, setPagando] = useState(false);
  const [comprobante, setComprobante] = useState(null);

  const setEstado = (siguiente) => {
    memoria = siguiente;
    setEstadoLocal(siguiente);
  };

  // Cotización real del dólar (el backend la lee del BCB y del P2P de Binance).
  const cargarCotizaciones = useCallback(async () => {
    setCargandoCot(true);
    try {
      setCotizaciones(await getCotizaciones());
      setErrorCot(null);
    } catch (err) {
      setErrorCot(err.message);
    } finally {
      setCargandoCot(false);
    }
  }, []);
  useEffect(() => { cargarCotizaciones(); }, [cargarCotizaciones]);
  const cotizacion = cotizaciones.find((c) => c.id === cotizacionId) || cotizaciones[0] || null;

  // Negocios reales del directorio (los 70 de paseoaranjuez.com).
  useEffect(() => {
    getEmpresas({ tipo: "NEGOCIO" })
      .then((lista) => setEmpresas([...lista].sort((a, b) => a.nombre.localeCompare(b.nombre))))
      .catch(() => setEmpresas([]))
      .finally(() => setCargando(false));
  }, []);

  const hoy = ahora(estado);
  const r = resumen(estado);
  const montoNum = Number(String(monto).replace(",", ".")) || 0;
  const devolucion = useMemo(() => (cotizacion ? calcularDevolucion(montoNum, cotizacion.valor) : { centUsd: 0 }),
    [montoNum, cotizacion]);
  const vista = cotizacion && empresa && montoNum > 0 && hoja === "pago"
    ? previsualizarPago(estado, { empresa, montoBs: montoNum, cotizacion }) : null;
  const tiendaEjemplo = empresas.find((e) => /apple land/i.test(e.nombre));

  const abrir = (tipo) => {
    setMonto("");
    setOrigen("Caja del local");
    setEmpresa(tipo === "compra" ? tiendaEjemplo || null : null);
    setHoja(tipo);
  };

  const confirmarCompra = () => {
    setEstado(registrarCompra(estado, { empresa, montoBs: montoNum, cotizacion }));
    setHoja(null);
  };

  const confirmarPago = async () => {
    setPagando(true);
    const ok = await confirmarConHuella();
    setPagando(false);
    if (!ok) return;
    const res = pagar(estado, { empresa, montoBs: montoNum, cotizacion, origen });
    setEstado(res.estado);
    setHoja(null);
    setComprobante(res.comprobante);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.atras} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={STITCH.primary} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.headerTitulo}>Billetera Paseo</Text>
          <Text style={styles.headerSub}>Saldo de regalo para gastar en el Paseo</Text>
        </View>
        <TouchableOpacity onPress={() => setHoja("como")} accessibilityLabel="Cómo funciona">
          <Ionicons name="help-circle-outline" size={26} color={STITCH.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View style={styles.aviso}>
          <Ionicons name="flask" size={16} color="#8A5A00" />
          <Text style={styles.avisoTexto}>
            Simulación: los saldos y pagos no mueven dinero real ni se guardan en el servidor. Son reales los negocios
            del Paseo y la cotización del dólar (BCB y Binance P2P); el % y los plazos son la propuesta del plan, aún por aprobar.
          </Text>
        </View>

        {/* Tarjeta de saldo */}
        <View style={styles.tarjeta}>
          <View style={styles.tarjetaDecoracion} />
          <Text style={styles.tarjetaEtiqueta}>DISPONIBLE · {user?.first_name || "cliente"}</Text>
          <Text style={styles.tarjetaSaldo}>{usd(r.disponible)}</Text>
          <Text style={styles.tarjetaBs}>
            {cotizacion ? `≈ ${bs(usdABs(r.disponible, cotizacion.valor))} hoy · ${cotizacion.nombre} ${cotizacion.valor}`
              : "Sin cotización del dólar: no se puede mostrar en Bs"}
          </Text>
          <View style={styles.tarjetaFila}>
            <View>
              <Text style={styles.tarjetaMini}>Pendiente</Text>
              <Text style={styles.tarjetaMiniValor}>{usd(r.pendiente)}</Text>
            </View>
            <View>
              <Text style={styles.tarjetaMini}>Vence en ≤ 15 días</Text>
              <Text style={[styles.tarjetaMiniValor, r.porVencer > 0 && { color: STITCH.oro }]}>{usd(r.porVencer)}</Text>
            </View>
          </View>
          <Text style={styles.tarjetaPie}>No se retira ni se transfiere · solo para negocios del Paseo</Text>
        </View>

        {/* Cotización */}
        <View style={styles.seccionFila}>
          <Text style={styles.seccion}>Cotización del dólar hoy</Text>
          <TouchableOpacity onPress={cargarCotizaciones} disabled={cargandoCot} accessibilityLabel="Actualizar cotización">
            {cargandoCot ? <ActivityIndicator color={STITCH.secondary} />
              : <Ionicons name="refresh" size={20} color={STITCH.secondary} />}
          </TouchableOpacity>
        </View>
        {cotizaciones.length ? (
          <View style={styles.cotizaciones}>
            {cotizaciones.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.cotizacion, cotizacion?.id === c.id && styles.cotizacionActiva]}
                onPress={() => setCotizacionId(c.id)}>
                <Text style={[styles.cotizacionNombre, cotizacion?.id === c.id && styles.blanco]}>{c.nombre}</Text>
                <Text style={[styles.cotizacionValor, cotizacion?.id === c.id && styles.blanco]}>Bs {c.valor}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {cotizacion ? (
          <>
            <Text style={styles.nota}>
              {cotizacion.fuente} · {cotizacion.detalle}. Consultado {hora(Date.parse(cotizacion.consultado_en))}.
              Al pagar, la cotización se congela y queda en el comprobante.
            </Text>
            {cotizacion.desactualizada ? (
              <Text style={styles.cuadroAviso}>⚠️ La fuente no respondió: es el último valor conocido.</Text>
            ) : null}
          </>
        ) : !cargandoCot ? (
          <Text style={styles.cuadroAviso}>
            ⚠️ No se pudo leer la cotización del BCB ni de Binance{errorCot ? ` (${errorCot})` : ""}. Toca actualizar.
          </Text>
        ) : null}

        {/* Acciones */}
        <View style={styles.acciones}>
          <TouchableOpacity style={[styles.accion, styles.accionPrincipal, !cotizacion && styles.botonInactivo]}
            disabled={!cotizacion} onPress={() => abrir("pago")}>
            <Ionicons name="scan" size={22} color={STITCH.white} />
            <Text style={[styles.accionTexto, styles.blanco]}>Pagar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.accion, !cotizacion && styles.botonInactivo]} disabled={!cotizacion}
            onPress={() => abrir("compra")}>
            <Ionicons name="receipt-outline" size={22} color={STITCH.primary} />
            <Text style={styles.accionTexto}>Simular compra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accion} onPress={() => setEstado(adelantarDias(estado, 7))}>
            <Ionicons name="play-forward-outline" size={22} color={STITCH.primary} />
            <Text style={styles.accionTexto}>+7 días</Text>
          </TouchableOpacity>
        </View>
        {estado.diasAdelantados ? (
          <Text style={styles.nota}>Fecha simulada: {fecha(hoy)} (+{estado.diasAdelantados} días)</Text>
        ) : null}

        {/* Saldos recibidos (lotes) */}
        <Text style={styles.seccion}>Saldos recibidos</Text>
        {!estado.lotes.length ? (
          <View style={styles.vacio}>
            <Ionicons name="gift-outline" size={22} color={STITCH.outline} />
            <Text style={styles.vacioTexto}>
              Aún no tienes saldo. Toca «Simular compra»: el cajero aprueba tu ticket y recibes el {CAMPANIA.porcentaje}% de vuelta
              {tiendaEjemplo ? ` (ej. un iPhone en ${tiendaEjemplo.nombre})` : ""}.
            </Text>
          </View>
        ) : estado.lotes.slice().reverse().map((l) => {
          const e = estadoLote(l, hoy);
          const estilo = ESTADOS_LOTE[e];
          return (
            <View key={l.id} style={styles.lote}>
              <View style={styles.loteFila}>
                <Text style={styles.loteEmpresa} numberOfLines={1}>{l.empresaNombre}</Text>
                <Text style={[styles.loteEstado, { color: estilo.color, backgroundColor: estilo.fondo }]}>{estilo.texto}</Text>
              </View>
              <Text style={styles.loteMonto}>{usd(l.restante)} <Text style={styles.loteDe}>de {usd(l.monto)}</Text></Text>
              <Text style={styles.loteMeta}>
                {e === "PENDIENTE" ? `Se libera el ${fecha(l.disponibleDesde)} · ` : ""}Vence el {fecha(l.venceEn)}
                {CAMPANIA.noMismaTienda ? ` · no se usa en ${l.empresaNombre}` : ""}
              </Text>
              {e === "PENDIENTE" ? (
                <TouchableOpacity onPress={() => setEstado(anularLote(estado, l.id))}>
                  <Text style={styles.enlace}>Simular que devolví el producto</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {/* Movimientos */}
        <Text style={styles.seccion}>Movimientos</Text>
        {!estado.movimientos.length ? <Text style={styles.nota}>Sin movimientos todavía.</Text> : null}
        {estado.movimientos.map((m) => (
          <View key={m.id} style={styles.mov}>
            <View style={[styles.movIcono, { backgroundColor: MOVIMIENTOS[m.tipo].color }]}>
              <Ionicons name={MOVIMIENTOS[m.tipo].icono} size={16} color={STITCH.white} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.movTitulo} numberOfLines={1}>{m.empresaNombre}</Text>
              <Text style={styles.movDetalle}>{m.detalle}</Text>
              <Text style={styles.movFecha}>{hora(m.fecha)}</Text>
            </View>
            <Text style={[styles.movMonto, { color: m.centUsd > 0 ? "#166534" : STITCH.onSurface }]}>
              {m.centUsd > 0 ? "+" : "−"}{usd(Math.abs(m.centUsd)).replace("USD ", "$")}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Simular compra aprobada por el cajero */}
      <Hoja visible={hoja === "compra"} titulo="Simular compra aprobada" onCerrar={() => setHoja(null)}>
        <Text style={styles.nota}>
          Igual que hoy con los puntos: escaneas la caja, pones NIT y monto, y el cajero aprueba el ticket.
          Con la campaña, además recibes saldo.
        </Text>
        <Text style={styles.etiqueta}>¿Dónde compraste?</Text>
        {cargando ? <ActivityIndicator color={STITCH.primary} /> : (
          <SelectorEmpresa empresas={empresas} valor={empresa} onElegir={setEmpresa} />
        )}
        <Text style={styles.etiqueta}>Monto del ticket (Bs)</Text>
        <TextInput style={styles.input} value={monto} onChangeText={setMonto} keyboardType="decimal-pad"
          placeholder={`Mínimo ${CAMPANIA.compraMinimaBs}`} placeholderTextColor={STITCH.outline} />
        {montoNum > 0 ? (
          <View style={styles.cuadro}>
            {devolucion.centUsd ? (
              <>
                <Text style={styles.cuadroTitulo}>Recibes {usd(devolucion.centUsd)}</Text>
                <Text style={styles.cuadroTexto}>
                  {CAMPANIA.porcentaje}% de {bs(Math.round(montoNum * 100))} a Bs {cotizacion?.valor} por USD
                  {devolucion.topado ? ` (tope de USD ${CAMPANIA.topeUsd} por compra)` : ""}.
                  {"\n"}Queda pendiente {CAMPANIA.diasPendiente} días y vence a los {CAMPANIA.diasVencimiento} días. Lo regala {CAMPANIA.financia}.
                </Text>
              </>
            ) : <Text style={styles.cuadroTexto}>{devolucion.motivo}</Text>}
          </View>
        ) : null}
        <TouchableOpacity style={[styles.boton, !(empresa && devolucion.centUsd) && styles.botonInactivo]}
          disabled={!(empresa && devolucion.centUsd)} onPress={confirmarCompra}>
          <Text style={styles.botonTexto}>El cajero aprueba el ticket</Text>
        </TouchableOpacity>
      </Hoja>

      {/* Pagar con la billetera (como si escanearas el QR de cobro de la caja) */}
      <Hoja visible={hoja === "pago"} titulo="Pagar con la billetera" onCerrar={() => setHoja(null)}>
        <Text style={styles.nota}>
          En la app real escaneas el QR de cobro que genera la caja (vence en 2 minutos). Aquí eliges el negocio y el monto
          como si los hubiera puesto el cajero.
        </Text>
        <View style={styles.origenes}>
          {["Caja del local", "Pedido de Comer"].map((o) => (
            <TouchableOpacity key={o} style={[styles.origen, origen === o && styles.cotizacionActiva]}
              onPress={() => { setOrigen(o); if (o === "Pedido de Comer" && empresa && !esComida(empresa)) setEmpresa(null); }}>
              <Text style={[styles.origenTexto, origen === o && styles.blanco]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.etiqueta}>Negocio que cobra</Text>
        {cargando ? <ActivityIndicator color={STITCH.primary} /> : (
          <SelectorEmpresa empresas={empresas} valor={empresa} onElegir={setEmpresa} soloComida={origen === "Pedido de Comer"} />
        )}
        <Text style={styles.etiqueta}>Monto a cobrar (Bs)</Text>
        <TextInput style={styles.input} value={monto} onChangeText={setMonto} keyboardType="decimal-pad"
          placeholder="Ej. 150" placeholderTextColor={STITCH.outline} />
        {vista ? (
          <View style={styles.cuadro}>
            <Text style={styles.cuadroTitulo}>{empresa.nombre} · {bs(vista.centBs)}</Text>
            <View style={styles.cuadroFila}><Text style={styles.cuadroTexto}>Con tu billetera</Text>
              <Text style={styles.cuadroValor}>{bs(vista.cubiertoBs)} ({usd(vista.usarUsd)})</Text></View>
            <View style={styles.cuadroFila}><Text style={styles.cuadroTexto}>Resto por QR del banco</Text>
              <Text style={styles.cuadroValor}>{bs(vista.restoBs)}</Text></View>
            <Text style={styles.cuadroTexto}>Cotización congelada: Bs {vista.tasa} por USD ({cotizacion?.nombre}).</Text>
            {vista.bloqueado > 0 ? (
              <Text style={styles.cuadroAviso}>
                {usd(vista.bloqueado)} de tu saldo vienen de {empresa.nombre} y no se pueden usar aquí.
              </Text>
            ) : null}
            {!vista.usarUsd ? <Text style={styles.cuadroAviso}>No tienes saldo disponible para este negocio.</Text> : null}
          </View>
        ) : null}
        <TouchableOpacity style={[styles.boton, !vista?.usarUsd && styles.botonInactivo]}
          disabled={!vista?.usarUsd || pagando} onPress={confirmarPago}>
          {pagando ? <ActivityIndicator color={STITCH.white} /> : (
            <><Ionicons name="finger-print" size={20} color={STITCH.white} /><Text style={styles.botonTexto}>Confirmar con huella</Text></>
          )}
        </TouchableOpacity>
      </Hoja>

      {/* Comprobante */}
      <Hoja visible={!!comprobante} titulo="Pago realizado" onCerrar={() => setComprobante(null)}>
        {comprobante ? (
          <View style={styles.comprobante}>
            <Ionicons name="checkmark-circle" size={56} color="#166534" style={styles.centro} />
            <Text style={styles.compMonto}>{bs(comprobante.cubiertoBs)}</Text>
            <Text style={styles.compEmpresa}>{comprobante.empresaNombre} · {comprobante.origen}</Text>
            {[
              ["Usado de tu billetera", usd(comprobante.usarUsd)],
              ["Cotización congelada", `Bs ${comprobante.tasa} / USD (${comprobante.cotizacionNombre})`],
              ["Resto por QR del banco", bs(comprobante.restoBs)],
              ["Referencia", comprobante.referencia],
              ["Fecha", hora(comprobante.fecha)],
            ].map(([k, v]) => (
              <View key={k} style={styles.cuadroFila}><Text style={styles.cuadroTexto}>{k}</Text><Text style={styles.cuadroValor}>{v}</Text></View>
            ))}
            <Text style={styles.nota}>El negocio ve «✓ Pagado con billetera» en su caja. {comprobante.restoBs ? "El resto lo cobra con su QR de siempre." : ""}</Text>
          </View>
        ) : null}
      </Hoja>

      {/* Cómo funciona */}
      <Hoja visible={hoja === "como"} titulo="Cómo funciona" onCerrar={() => setHoja(null)}>
        {[
          ["receipt", "Ganas saldo", `Compras en una tienda con campaña y el cajero aprueba tu ticket: recibes el ${CAMPANIA.porcentaje}% en USD (tope USD ${CAMPANIA.topeUsd}, compra mínima Bs ${CAMPANIA.compraMinimaBs}).`],
          ["time", "Queda pendiente", `${CAMPANIA.diasPendiente} días por si devuelves el producto. Después lo puedes usar durante ${CAMPANIA.diasVencimiento} días.`],
          ["swap-horizontal", "Siempre en dólares", "Tu saldo está en USD para que no pierda valor; lo ves en Bs con la cotización del día, que se congela al pagar."],
          ["storefront", "Lo gastas en el Paseo", `En cualquier negocio adherido${CAMPANIA.noMismaTienda ? ", menos en la tienda que te lo dio" : ""}, en caja o en pedidos de Comer. Si no alcanza, pagas el resto con QR.`],
          ["shield-checkmark", "Seguro", "Cada pago se confirma con tu huella. El saldo no se retira, no se transfiere y lo regala el Paseo."],
        ].map(([icono, titulo, texto]) => (
          <View key={titulo} style={styles.paso}>
            <View style={styles.pasoIcono}><Ionicons name={icono} size={18} color={STITCH.primary} /></View>
            <View style={styles.flex1}>
              <Text style={styles.pasoTitulo}>{titulo}</Text>
              <Text style={styles.pasoTexto}>{texto}</Text>
            </View>
          </View>
        ))}
      </Hoja>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STITCH.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, height: 64,
    borderBottomWidth: 1, borderBottomColor: STITCH.surfaceHigh },
  atras: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 19 },
  headerSub: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12 },
  contenido: { padding: 20, paddingBottom: 40 },
  flex1: { flex: 1 },
  blanco: { color: STITCH.white },
  centro: { alignSelf: "center" },

  aviso: { flexDirection: "row", gap: 8, backgroundColor: "#FFF4CC", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#F5B301" },
  avisoTexto: { flex: 1, color: "#8A5A00", fontFamily: FUENTES.texto, fontSize: 12.5, lineHeight: 18 },

  tarjeta: { marginTop: 16, backgroundColor: STITCH.primary, borderRadius: 22, padding: 20, overflow: "hidden" },
  tarjetaDecoracion: { position: "absolute", right: -50, top: -40, width: 190, height: 190, borderRadius: 95,
    borderWidth: 28, borderColor: "rgba(246,190,59,0.14)" },
  tarjetaEtiqueta: { color: STITCH.secondaryContainer, fontFamily: FUENTES.textoFuerte, fontSize: 11, letterSpacing: 0.8 },
  tarjetaSaldo: { color: STITCH.white, fontFamily: FUENTES.titulo, fontSize: 36, marginTop: 6 },
  tarjetaBs: { color: "#c9d6e0", fontFamily: FUENTES.textoMedio, fontSize: 13.5 },
  tarjetaFila: { flexDirection: "row", gap: 28, marginTop: 16 },
  tarjetaMini: { color: "#9fb4c4", fontFamily: FUENTES.texto, fontSize: 11.5 },
  tarjetaMiniValor: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 16, marginTop: 2 },
  tarjetaPie: { color: "#9fb4c4", fontFamily: FUENTES.texto, fontSize: 11, marginTop: 14 },

  seccionFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seccion: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 18, marginTop: 24, marginBottom: 8 },
  nota: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12, lineHeight: 17, marginTop: 6 },
  enlace: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12.5, marginTop: 8 },

  cotizaciones: { flexDirection: "row", gap: 10 },
  cotizacion: { flex: 1, backgroundColor: STITCH.surfaceLowest, borderRadius: 14, padding: 12, ...SOMBRA },
  cotizacionActiva: { backgroundColor: STITCH.secondary },
  cotizacionNombre: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 12 },
  cotizacionValor: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 18, marginTop: 2 },

  acciones: { flexDirection: "row", gap: 10, marginTop: 18 },
  accion: { flex: 1, alignItems: "center", gap: 6, backgroundColor: STITCH.surfaceLowest, borderRadius: 14,
    paddingVertical: 14, ...SOMBRA },
  accionPrincipal: { backgroundColor: STITCH.primaryContainer },
  accionTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 12.5, textAlign: "center" },

  vacio: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: STITCH.surfaceLowest, borderRadius: 14, padding: 14 },
  vacioTexto: { flex: 1, color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13, lineHeight: 19 },

  lote: { backgroundColor: STITCH.surfaceLowest, borderRadius: 14, padding: 14, marginBottom: 10, ...SOMBRA },
  loteFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  loteEmpresa: { flex: 1, color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 14.5 },
  loteEstado: { fontFamily: FUENTES.textoFuerte, fontSize: 11, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
  loteMonto: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20, marginTop: 6 },
  loteDe: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12.5 },
  loteMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12, marginTop: 4 },

  mov: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: STITCH.surfaceHigh },
  movIcono: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  movTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  movDetalle: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12 },
  movFecha: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 11 },
  movMonto: { fontFamily: FUENTES.tituloBold, fontSize: 14.5 },

  hojaFondo: { flex: 1, backgroundColor: "rgba(0,20,35,0.55)", justifyContent: "flex-end" },
  hoja: { maxHeight: "92%", backgroundColor: STITCH.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  hojaCabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  hojaTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  etiqueta: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13.5, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: STITCH.surfaceLowest, borderRadius: 12, borderWidth: 1, borderColor: STITCH.outlineVariant,
    paddingHorizontal: 14, height: 48, fontFamily: FUENTES.textoMedio, fontSize: 16, color: STITCH.onSurface },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: STITCH.surfaceLowest, borderRadius: 12,
    borderWidth: 1, borderColor: STITCH.outlineVariant, paddingHorizontal: 12, height: 42 },
  buscadorInput: { flex: 1, fontFamily: FUENTES.texto, fontSize: 14, color: STITCH.onSurface },
  selector: { maxHeight: 220, marginTop: 8 },
  opcion: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12 },
  opcionActiva: { backgroundColor: "#E3F2FB" },
  opcionLogo: { width: 32, height: 32, borderRadius: 16, backgroundColor: STITCH.surfaceLowest },
  opcionLogoVacio: { alignItems: "center", justifyContent: "center", backgroundColor: STITCH.surfaceHigh },
  opcionNombre: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  opcionMeta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 11.5 },
  origenes: { flexDirection: "row", gap: 8, marginTop: 12 },
  origen: { flex: 1, alignItems: "center", backgroundColor: STITCH.surfaceLowest, borderRadius: 999, paddingVertical: 9, ...SOMBRA },
  origenTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },

  cuadro: { backgroundColor: STITCH.surfaceLowest, borderRadius: 14, padding: 14, marginTop: 14, gap: 6,
    borderWidth: 1, borderColor: STITCH.outlineVariant },
  cuadroTitulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 17 },
  cuadroFila: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 2 },
  cuadroTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5, lineHeight: 18 },
  cuadroValor: { flexShrink: 1, textAlign: "right", color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  cuadroAviso: { color: "#8A5A00", fontFamily: FUENTES.textoMedio, fontSize: 12.5 },
  boton: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", backgroundColor: STITCH.primary,
    borderRadius: 999, paddingVertical: 15, marginTop: 18, marginBottom: 8 },
  botonInactivo: { opacity: 0.4 },
  botonTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },

  comprobante: { gap: 6 },
  compMonto: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 30, textAlign: "center" },
  compEmpresa: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 13.5, textAlign: "center", marginBottom: 10 },

  paso: { flexDirection: "row", gap: 12, marginTop: 14 },
  pasoIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: STITCH.surfaceHigh, alignItems: "center", justifyContent: "center" },
  pasoTitulo: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 14.5 },
  pasoTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13, lineHeight: 19, marginTop: 2 },
});
