import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUENTES, SOMBRA, STITCH } from "../constants/theme";
import { useCarrito } from "../context/CarritoContext";

export const bs = (n) => `Bs ${Number(n).toLocaleString("es-BO", { maximumFractionDigits: 2 })}`;
export const pisoTexto = (piso) => (piso === "PB" ? "Planta baja" : piso ? `Piso ${piso}` : "");

// Reserva del retiro: hoy y los 2 días siguientes, cada 30 min entre 09:00 y 22:00,
// con al menos 30 min para que el local lo prepare (el backend exige 20).
const DIAS_RESERVA = ["Hoy", "Mañana", "Pasado mañana"];
function horarios(diaIndice) {
  const ahora = new Date();
  const minimo = ahora.getTime() + 30 * 60000;
  const lista = [];
  for (let minutos = 9 * 60; minutos <= 22 * 60; minutos += 30) {
    const d = new Date(ahora);
    d.setDate(d.getDate() + diaIndice);
    d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    if (d.getTime() >= minimo) lista.push(d);
  }
  return lista;
}
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Hoja con el carrito: productos, cantidades, total y confirmar el pedido. */
export function CarritoSheet({ visible, onCerrar, onConfirmar, enviando, error }) {
  const { lista, unidades, total, local, cambiar, quitar, vaciar } = useCarrito();
  const [modo, setModo] = useState("ahora"); // "ahora" | "reservar"
  const [dia, setDia] = useState(0);
  const [hora, setHora] = useState(null); // Date elegida
  const opciones = useMemo(() => horarios(dia), [dia, visible]); // se recalcula al abrir
  const reservaLista = modo === "reservar" && hora;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          <View style={styles.cabecera}>
            {local?.empresa_logo ? <Image source={{ uri: local.empresa_logo }} style={styles.logo} /> : (
              <View style={[styles.logo, styles.logoVacio]}><Ionicons name="restaurant" size={20} color={STITCH.oro} /></View>
            )}
            <View style={styles.flex}>
              <Text style={styles.titulo}>Tu pedido</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {local ? `${local.empresa_nombre}${local.piso ? ` · ${pisoTexto(local.piso)}` : ""}` : "Carrito vacío"}
              </Text>
            </View>
            <TouchableOpacity onPress={onCerrar} style={styles.cerrar} accessibilityLabel="Cerrar carrito">
              <Ionicons name="close" size={24} color={STITCH.onSurface} />
            </TouchableOpacity>
          </View>

          {lista.length ? (
            <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
              {lista.map(({ producto: p, cantidad }) => (
                <View key={p.id} style={styles.item}>
                  {p.foto || p.empresa_logo ? (
                    <Image source={{ uri: p.foto || p.empresa_logo }} style={styles.foto}
                      resizeMode={p.foto ? "cover" : "contain"} />
                  ) : <View style={[styles.foto, styles.logoVacio]} />}
                  <View style={styles.flex}>
                    <Text style={styles.nombre} numberOfLines={2}>{p.nombre}</Text>
                    <Text style={styles.unitario}>{bs(p.precio)} c/u</Text>
                    <View style={styles.filaItem}>
                      <View style={styles.stepper}>
                        <TouchableOpacity onPress={() => cambiar(p, -1)} style={styles.paso} accessibilityLabel={`Quitar un ${p.nombre}`}>
                          <Ionicons name={cantidad === 1 ? "trash-outline" : "remove"} size={16} color={STITCH.primary} />
                        </TouchableOpacity>
                        <Text style={styles.cantidad}>{cantidad}</Text>
                        <TouchableOpacity onPress={() => cambiar(p, 1)} style={styles.paso} accessibilityLabel={`Agregar un ${p.nombre}`}>
                          <Ionicons name="add" size={16} color={STITCH.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.subtotal}>{bs(Number(p.precio) * cantidad)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => quitar(p.id)} style={styles.eliminar} accessibilityLabel={`Eliminar ${p.nombre}`}>
                    <Ionicons name="close-circle" size={20} color={STITCH.outline} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={vaciar} style={styles.vaciar}>
                <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                <Text style={styles.vaciarTexto}>Vaciar carrito</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.vacio}>
              <Ionicons name="bag-outline" size={40} color={STITCH.outline} />
              <Text style={styles.vacioTexto}>Agrega platos del menú con el botón +.</Text>
            </View>
          )}

          {lista.length ? (
            <View style={styles.pie}>
              <Text style={styles.cuandoTitulo}>¿Cuándo lo retiras?</Text>
              <View style={styles.modos}>
                <TouchableOpacity style={[styles.modo, modo === "ahora" && styles.modoActivo]} onPress={() => setModo("ahora")}>
                  <Ionicons name="flash" size={16} color={modo === "ahora" ? STITCH.white : STITCH.primary} />
                  <Text style={[styles.modoTexto, modo === "ahora" && styles.modoTextoActivo]}>Lo antes posible</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modo, modo === "reservar" && styles.modoActivo]} onPress={() => setModo("reservar")}>
                  <Ionicons name="calendar" size={16} color={modo === "reservar" ? STITCH.white : STITCH.primary} />
                  <Text style={[styles.modoTexto, modo === "reservar" && styles.modoTextoActivo]}>Reservar hora</Text>
                </TouchableOpacity>
              </View>
              {modo === "reservar" ? (
                <View style={styles.reserva}>
                  <View style={styles.chips}>
                    {DIAS_RESERVA.map((t, i) => (
                      <TouchableOpacity key={t} onPress={() => { setDia(i); setHora(null); }}
                        style={[styles.chip, dia === i && styles.chipActivo]}>
                        <Text style={[styles.chipTexto, dia === i && styles.chipTextoActivo]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horasFila} contentContainerStyle={styles.horas}>
                    {opciones.length ? opciones.map((d) => (
                      <TouchableOpacity key={d.getTime()} onPress={() => setHora(d)}
                        style={[styles.chip, hora?.getTime() === d.getTime() && styles.chipActivo]}>
                        <Text style={[styles.chipTexto, hora?.getTime() === d.getTime() && styles.chipTextoActivo]}>{hhmm(d)}</Text>
                      </TouchableOpacity>
                    )) : <Text style={styles.retiroTexto}>Ya no quedan horarios hoy: elige mañana.</Text>}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.retiro}>
                <Ionicons name="storefront-outline" size={16} color={STITCH.secondary} />
                <Text style={styles.retiroTexto}>Pagas con QR al confirmar y retiras en el local con tu código (sin delivery).</Text>
              </View>
              <View style={styles.totalFila}>
                <Text style={styles.totalLabel}>Total · {unidades} {unidades === 1 ? "producto" : "productos"}</Text>
                <Text style={styles.total}>{bs(total)}</Text>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={[styles.confirmar, modo === "reservar" && !hora && styles.desactivado]}
                onPress={() => onConfirmar(reservaLista ? hora.toISOString() : null)}
                disabled={enviando || (modo === "reservar" && !hora)}>
                {enviando ? <ActivityIndicator color={STITCH.primary} /> : (
                  <Text style={styles.confirmarTexto}>
                    {reservaLista
                      ? `Pagar y reservar ${DIAS_RESERVA[dia].toLowerCase()} ${hhmm(hora)} · ${bs(total)}`
                      : modo === "reservar" ? "Elige la hora de retiro" : `Confirmar pedido · ${bs(total)}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Aviso cuando se agrega un plato de otro local (un pedido = un solo local). */
export function AvisoOtroLocal({ conflicto, onCancelar, onVaciar }) {
  if (!conflicto) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={[styles.fondo, styles.centrado]}>
        <View style={styles.aviso}>
          <Ionicons name="swap-horizontal" size={36} color={STITCH.secondary} />
          <Text style={styles.titulo}>Un pedido por local</Text>
          <Text style={styles.avisoTexto}>
            Tu carrito tiene productos de <Text style={styles.negrita}>{conflicto.actual}</Text>.
            ¿Lo vacías para pedir en <Text style={styles.negrita}>{conflicto.nuevo.empresa_nombre}</Text>?
          </Text>
          <View style={styles.avisoBotones}>
            <TouchableOpacity style={[styles.avisoBoton, styles.avisoBotonSecundario]} onPress={onCancelar}>
              <Text style={styles.avisoBotonSecundarioTexto}>Mantener</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avisoBoton} onPress={onVaciar}>
              <Text style={styles.avisoBotonTexto}>Vaciar y agregar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  centrado: { justifyContent: "center", alignItems: "center", padding: 24 },
  hoja: { width: "100%", maxWidth: 560, alignSelf: "center", maxHeight: "88%", backgroundColor: STITCH.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: STITCH.outlineVariant },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: STITCH.surfaceLowest },
  logoVacio: { backgroundColor: STITCH.primaryContainer, alignItems: "center", justifyContent: "center" },
  titulo: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 20 },
  sub: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 13 },
  cerrar: { padding: 4 },
  lista: { flexGrow: 0 },
  listaContenido: { padding: 16, gap: 10 },
  item: { flexDirection: "row", gap: 12, backgroundColor: STITCH.surfaceLowest, borderRadius: 16, padding: 10, ...SOMBRA },
  foto: { width: 72, height: 72, borderRadius: 12, backgroundColor: STITCH.surfaceHigh },
  nombre: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 14.5, paddingRight: 18 },
  unitario: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12, marginTop: 2 },
  filaItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: STITCH.surfaceLow, borderRadius: 999,
    paddingHorizontal: 4, paddingVertical: 2 },
  paso: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: STITCH.surfaceLowest },
  cantidad: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 15, minWidth: 14, textAlign: "center" },
  subtotal: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 15 },
  eliminar: { position: "absolute", top: 6, right: 6, padding: 2 },
  vaciar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  vaciarTexto: { color: "#b91c1c", fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  vacio: { alignItems: "center", gap: 8, padding: 40 },
  vacioTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14 },
  pie: { padding: 16, paddingBottom: 24, gap: 10, borderTopWidth: 1, borderTopColor: STITCH.outlineVariant,
    backgroundColor: STITCH.surfaceLowest },
  retiro: { flexDirection: "row", alignItems: "center", gap: 8 },
  retiroTexto: { flex: 1, color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 12.5 },
  totalFila: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  totalLabel: { color: STITCH.onSurface, fontFamily: FUENTES.textoFuerte, fontSize: 14 },
  total: { color: STITCH.primary, fontFamily: FUENTES.titulo, fontSize: 22 },
  error: { color: "#b91c1c", fontFamily: FUENTES.texto, fontSize: 13 },
  cuandoTitulo: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 14.5 },
  modos: { flexDirection: "row", gap: 8 },
  modo: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10,
    borderRadius: 12, backgroundColor: STITCH.surfaceLow },
  modoActivo: { backgroundColor: STITCH.primary },
  modoTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13.5 },
  modoTextoActivo: { color: STITCH.white },
  reserva: { gap: 8 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  horasFila: { flexGrow: 0 },
  horas: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: STITCH.surfaceLow },
  chipActivo: { backgroundColor: STITCH.secondary },
  chipTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 13 },
  chipTextoActivo: { color: STITCH.white },
  desactivado: { opacity: 0.6 },
  confirmar: { backgroundColor: STITCH.oro, borderRadius: 999, paddingVertical: 15, alignItems: "center", minHeight: 50 },
  confirmarTexto: { color: STITCH.primary, fontFamily: FUENTES.tituloBold, fontSize: 16 },
  aviso: { width: "100%", maxWidth: 400, backgroundColor: STITCH.surfaceLowest, borderRadius: 22, padding: 22,
    alignItems: "center", gap: 10 },
  avisoTexto: { color: STITCH.onSurfaceVariant, fontFamily: FUENTES.texto, fontSize: 14, textAlign: "center", lineHeight: 20 },
  negrita: { fontFamily: FUENTES.textoFuerte, color: STITCH.onSurface },
  avisoBotones: { flexDirection: "row", gap: 10, marginTop: 6, alignSelf: "stretch" },
  avisoBoton: { flex: 1, backgroundColor: STITCH.primary, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  avisoBotonTexto: { color: STITCH.white, fontFamily: FUENTES.textoFuerte, fontSize: 14 },
  avisoBotonSecundario: { backgroundColor: STITCH.surfaceLow },
  avisoBotonSecundarioTexto: { color: STITCH.primary, fontFamily: FUENTES.textoFuerte, fontSize: 14 },
});
