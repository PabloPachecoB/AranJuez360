import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { avisarLlegada, cancelarPedido, getPedido, simularPago } from "../services/pedidosService";
import { bs, pisoTexto } from "./CarritoSheet";

// PaseoYa · Comer: pago con QR (banco simulado) y seguimiento del pedido hasta el retiro en el local.

const PASOS = [
  { estado: "RECIBIDO", texto: "Pagado", icono: "card" },
  { estado: "CONFIRMADO", texto: "Confirmado", icono: "checkmark" },
  { estado: "PREPARANDO", texto: "Preparando", icono: "flame" },
  { estado: "LISTO_PARA_RECOGER", texto: "Listo", icono: "bag-check" },
  { estado: "CLIENTE_LLEGO", texto: "En el Paseo", icono: "walk" },
  { estado: "ENTREGADO", texto: "Entregado", icono: "checkmark-done" },
];
const ORDEN = PASOS.map((p) => p.estado);
export const FINALES = ["ENTREGADO", "CANCELADO"];

/** "hoy 13:30", "mañana 10:00" o "sáb 5, 12:00". */
export function cuandoRetiro(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (d.toDateString() === manana.toDateString()) return `mañana ${hora}`;
  return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()}, ${hora}`;
}

function restante(vence) {
  const ms = new Date(vence).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Cobro con QR: se queda esperando hasta que el banco (simulado) confirma el pago. */
export function PagoQRModal({ pedido: inicial, onCerrar, onPagado }) {
  const [pedido, setPedido] = useState(inicial);
  const [reloj, setReloj] = useState(restante(inicial.pago_vence_en));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const avisado = useRef(false);

  // Consulta el estado del cobro cada 3 s (lo confirma el banco desde otra pantalla o celular).
  useEffect(() => {
    const id = setInterval(async () => {
      setReloj(restante(pedido.pago_vence_en));
      try {
        setPedido(await getPedido(pedido.id));
      } catch {
        // sin conexión: se reintenta en la próxima vuelta
      }
    }, 3000);
    const segundero = setInterval(() => setReloj(restante(pedido.pago_vence_en)), 1000);
    return () => {
      clearInterval(id);
      clearInterval(segundero);
    };
  }, [pedido.id, pedido.pago_vence_en]);

  useEffect(() => {
    if (pedido.estado !== "PENDIENTE_PAGO" && pedido.estado !== "CANCELADO" && !avisado.current) {
      avisado.current = true;
      onPagado?.(pedido);
    }
  }, [pedido, onPagado]);

  const accion = async (fn) => {
    setOcupado(true);
    setError(null);
    try {
      setPedido(await fn(pedido.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const pagado = pedido.estado !== "PENDIENTE_PAGO" && pedido.estado !== "CANCELADO";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <View style={styles.tarjeta}>
          <TouchableOpacity onPress={onCerrar} style={styles.cerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={22} color={STITCH.onSurface} />
          </TouchableOpacity>

          {pagado ? (
            <>
              <Ionicons name="checkmark-circle" size={56} color="#166534" />
              <Text style={styles.titulo}>¡Pago recibido!</Text>
              <Text style={styles.texto}>
                {pedido.retiro_programado
                  ? `${pedido.empresa_nombre} lo tendrá listo para retirar ${cuandoRetiro(pedido.retiro_programado)}.`
                  : `${pedido.empresa_nombre} ya tiene tu pedido en cola. Te avisamos aquí cuando esté listo.`}
              </Text>
              <Text style={styles.etiqueta}>Tu código de retiro</Text>
              <Text style={styles.codigo} selectable>{pedido.codigo_retiro}</Text>
              <TouchableOpacity style={styles.boton} onPress={onCerrar}>
                <Text style={styles.botonTexto}>Seguir mi pedido</Text>
              </TouchableOpacity>
            </>
          ) : pedido.estado === "CANCELADO" ? (
            <>
              <Ionicons name="close-circle" size={56} color="#b91c1c" />
              <Text style={styles.titulo}>Pedido cancelado</Text>
              <Text style={styles.texto}>El QR venció o cancelaste el pedido. Puedes volver a pedir desde el menú.</Text>
              <TouchableOpacity style={styles.boton} onPress={onCerrar}>
                <Text style={styles.botonTexto}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.bancoFila}>
                <Ionicons name="qr-code" size={18} color={STITCH.secondary} />
                <Text style={styles.banco}>Paga con QR desde tu banco</Text>
              </View>
              <Text style={styles.monto}>{bs(pedido.total)}</Text>
              <Text style={styles.texto}>{pedido.empresa_nombre} · ref. {pedido.pago_referencia}</Text>
              <View style={styles.qr}><QRCode value={pedido.pago_qr} size={200} /></View>
              <View style={styles.esperando}>
                <ActivityIndicator size="small" color={STITCH.secondary} />
                <Text style={styles.esperandoTexto}>Esperando el pago · vence en {reloj}</Text>
              </View>
              <Text style={styles.ayuda}>
                Escanéalo con la cámara de otro celular para abrir el Banco Simulado, o usa el botón de demo.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={styles.boton} onPress={() => accion(simularPago)} disabled={ocupado}>
                {ocupado ? <ActivityIndicator color={STITCH.white} /> : <Text style={styles.botonTexto}>Simular pago (demo)</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => accion(cancelarPedido)} disabled={ocupado} style={styles.secundario}>
                <Text style={styles.secundarioTexto}>Cancelar pedido</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Pedido en "Mis pedidos": línea de estados, pagar, avisar llegada y código de retiro. */
export function TarjetaPedido({ pedido, onPagar, onCambio }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [verCodigo, setVerCodigo] = useState(false);
  const indice = ORDEN.indexOf(pedido.estado);
  const cancelado = pedido.estado === "CANCELADO";
  const pendiente = pedido.estado === "PENDIENTE_PAGO";
  const retirable = pedido.estado === "LISTO_PARA_RECOGER" || pedido.estado === "CLIENTE_LLEGO";

  const cancelar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await cancelarPedido(pedido.id);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const llegue = async () => {
    setOcupado(true);
    setError(null);
    try {
      await avisarLlegada(pedido.id);
      setVerCodigo(true);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <View style={[styles.pedido, retirable && styles.pedidoListo]}>
      <View style={styles.pedidoCabecera}>
        {pedido.empresa_logo ? <Image source={{ uri: pedido.empresa_logo }} style={styles.logo} /> : null}
        <View style={styles.flex}>
          <Text style={styles.local}>{pedido.empresa_nombre}</Text>
          <Text style={styles.meta}>
            {pisoTexto(pedido.empresa_piso)}{pedido.empresa_local ? ` · local ${pedido.empresa_local}` : ""} · {bs(pedido.total)}
          </Text>
        </View>
        <Text style={[styles.estado, cancelado && styles.rojo, pendiente && styles.ambar, retirable && styles.verde]}>
          {pedido.estado_display}
        </Text>
      </View>

      <Text style={styles.items}>{pedido.items.map((it) => `${it.cantidad} × ${it.producto_nombre}`).join(" · ")}</Text>
      {!FINALES.includes(pedido.estado) ? (
        <View style={styles.cuando}>
          <Ionicons name={pedido.retiro_programado ? "calendar" : "flash"} size={14} color={STITCH.secondary} />
          <Text style={styles.cuandoTexto}>
            {pedido.retiro_programado ? `Reservado para retirar ${cuandoRetiro(pedido.retiro_programado)}` : "Retiro lo antes posible"}
          </Text>
        </View>
      ) : null}

      {!cancelado && !pendiente ? (
        <View style={styles.linea}>
          {PASOS.map((paso, i) => {
            const hecho = i <= indice;
            return (
              <View key={paso.estado} style={styles.paso}>
                <View style={[styles.pasoIcono, hecho && styles.pasoHecho, i === indice && styles.pasoActual]}>
                  <Ionicons name={paso.icono} size={13} color={hecho ? STITCH.white : STITCH.outline} />
                </View>
                <Text style={[styles.pasoTexto, hecho && styles.pasoTextoHecho]} numberOfLines={1}>{paso.texto}</Text>
                {i < PASOS.length - 1 ? <View style={[styles.conector, i < indice && styles.conectorHecho]} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {cancelado && pedido.reembolsado_en ? (
        <Text style={styles.reembolso}>El local canceló el pedido: te devolvimos {bs(pedido.total)} (simulado).</Text>
      ) : null}

      {pendiente ? (
        <View style={styles.pendienteFila}>
          <TouchableOpacity style={[styles.botonFila, styles.flex]} onPress={() => onPagar(pedido)}>
            <Ionicons name="qr-code" size={18} color={STITCH.primary} />
            <Text style={styles.botonFilaTexto}>Pagar con QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelar} disabled={ocupado}
            accessibilityLabel="Cancelar pedido">
            {ocupado ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.botonCancelarTexto}>Cancelar</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {pedido.estado === "LISTO_PARA_RECOGER" ? (
        <TouchableOpacity style={[styles.botonFila, styles.botonVerde]} onPress={llegue} disabled={ocupado}>
          {ocupado ? <ActivityIndicator color={STITCH.white} /> : (
            <>
              <Ionicons name="walk" size={18} color={STITCH.white} />
              <Text style={[styles.botonFilaTexto, styles.blanco]}>Ya llegué al Paseo</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      {retirable ? (
        <TouchableOpacity onPress={() => setVerCodigo((v) => !v)} style={styles.codigoFila}>
          <Text style={styles.codigoChico}>Código de retiro {pedido.codigo_retiro}</Text>
          <Ionicons name={verCodigo ? "chevron-up" : "qr-code-outline"} size={18} color={STITCH.primary} />
        </TouchableOpacity>
      ) : null}
      {retirable && verCodigo ? (
        <View style={styles.retiro}>
          <View style={styles.qrChico}><QRCode value={pedido.codigo_retiro} size={150} /></View>
          <Text style={styles.ayuda}>Muéstralo en {pedido.empresa_nombre}: el local lo valida y te entrega tu pedido.</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  tarjeta: { width: "100%", maxWidth: 400, backgroundColor: STITCH.surfaceLowest, borderRadius: 24, padding: 22,
    alignItems: "center", gap: 8 },
  cerrar: { position: "absolute", top: 10, right: 10, padding: 6, zIndex: 2 },
  bancoFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  banco: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  monto: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 34 },
  titulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22 },
  texto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center" },
  qr: { padding: 12, backgroundColor: STITCH.white, borderRadius: 16, borderWidth: 1, borderColor: STITCH.outlineVariant, marginVertical: 6 },
  esperando: { flexDirection: "row", alignItems: "center", gap: 8 },
  esperandoTexto: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  ayuda: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 12, textAlign: "center" },
  etiqueta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.textoMedio, fontSize: 13, marginTop: 6 },
  codigo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 30, letterSpacing: 4 },
  boton: { alignSelf: "stretch", backgroundColor: STITCH.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center",
    marginTop: 8, minHeight: 48 },
  botonTexto: { color: STITCH.white, fontFamily: FUENTES.tituloBold, fontSize: 15 },
  secundario: { paddingVertical: 8 },
  secundarioTexto: { color: "#b91c1c", fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  error: { color: "#b91c1c", fontFamily: FUENTES.texto, fontSize: 13, textAlign: "center" },

  pedido: { backgroundColor: STITCH.surfaceLowest, borderRadius: 18, padding: 14, marginBottom: 12, gap: 8, ...SOMBRA },
  pedidoListo: { borderWidth: 2, borderColor: "#166534" },
  pedidoCabecera: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: STITCH.surfaceLow },
  local: { color: STITCH.onSurface, fontFamily: FUENTES.tituloBold, fontSize: 15.5 },
  meta: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5 },
  estado: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12, maxWidth: 110, textAlign: "right" },
  rojo: { color: "#b91c1c" },
  ambar: { color: "#8A5A00" },
  verde: { color: "#166534" },
  items: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  cuando: { flexDirection: "row", alignItems: "center", gap: 6 },
  cuandoTexto: { color: STITCH.secondary, fontFamily: FUENTES.textoFuerte, fontSize: 12.5 },
  linea: { flexDirection: "row", marginTop: 4 },
  paso: { flex: 1, alignItems: "center", gap: 4 },
  pasoIcono: { width: 26, height: 26, borderRadius: 13, backgroundColor: STITCH.surfaceLow, alignItems: "center",
    justifyContent: "center", zIndex: 1 },
  pasoHecho: { backgroundColor: STITCH.secondary },
  pasoActual: { backgroundColor: "#166534", transform: [{ scale: 1.15 }] },
  pasoTexto: { color: STITCH.outline, fontFamily: FUENTES.texto, fontSize: 10 },
  pasoTextoHecho: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte },
  conector: { position: "absolute", top: 12, left: "60%", width: "80%", height: 2, backgroundColor: STITCH.surfaceHigh },
  conectorHecho: { backgroundColor: STITCH.secondary },
  reembolso: { color: "#8A5A00", fontFamily: FUENTES.texto, fontSize: 12.5 },
  botonFila: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: STITCH.oro,
    borderRadius: 999, paddingVertical: 11, minHeight: 44 },
  botonVerde: { backgroundColor: "#166534" },
  pendienteFila: { flexDirection: "row", gap: 8 },
  botonCancelar: { borderWidth: 1.5, borderColor: "#b91c1c", borderRadius: 999, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center", minHeight: 44 },
  botonCancelarTexto: { color: "#b91c1c", fontFamily: FUENTES.tituloBold, fontSize: 14 },
  botonFilaTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 14.5 },
  blanco: { color: STITCH.white },
  codigoFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  codigoChico: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 14, letterSpacing: 1 },
  retiro: { alignItems: "center", gap: 6 },
  qrChico: { padding: 10, backgroundColor: STITCH.white, borderRadius: 14 },
});
