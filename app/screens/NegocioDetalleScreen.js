import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { obtenerEmpresa } from "../services/empresasService";
import { useCarrito } from "../context/CarritoContext";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function NegocioDetalleScreen({ route, navigation }) {
  const { empresaId } = route.params;
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const carrito = useCarrito();

  useEffect(() => {
    obtenerEmpresa(empresaId)
      .then(setEmpresa)
      .finally(() => setCargando(false));
  }, [empresaId]);

  if (cargando) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!empresa) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.vacio}>No se pudo cargar este negocio.</Text>
      </SafeAreaView>
    );
  }

  const diaHoy = (new Date().getDay() + 6) % 7; // JS: 0=Dom..6=Sáb -> backend: 0=Lun..6=Dom
  const horarioHoy = empresa.horarios?.find((h) => h.dia === diaHoy);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.titulo}>{empresa.nombre}</Text>
          <Text style={styles.subtitulo}>
            Piso {empresa.piso || "-"} · Local {empresa.local || "-"}
          </Text>
        </View>
        {carrito?.cantidadTotal > 0 && (
          <TouchableOpacity style={styles.carritoBadge} onPress={() => navigation.navigate("Carrito")}>
            <Ionicons name="cart" size={18} color={COLORS.white} />
            <Text style={styles.carritoBadgeTexto}>{carrito.cantidadTotal}</Text>
          </TouchableOpacity>
        )}
      </View>

      {empresa.descripcion ? <Text style={styles.descripcion}>{empresa.descripcion}</Text> : null}
      {horarioHoy && (
        <View style={styles.horarioRow}>
          <Ionicons name="time-outline" size={14} color={COLORS.muted} />
          <Text style={styles.horarioTexto}>
            {horarioHoy.cerrado
              ? `Hoy (${DIAS[horarioHoy.dia]}) cerrado`
              : `${DIAS[horarioHoy.dia]} ${horarioHoy.abre}–${horarioHoy.cierra}`}
          </Text>
        </View>
      )}

      <FlatList
        data={empresa.productos || []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vacio}>Este negocio todavía no publicó productos.</Text>}
        renderItem={({ item }) => {
          const enPromo = item.en_promocion && item.precio_promocion;
          return (
            <View style={styles.producto}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productoNombre}>{item.nombre}</Text>
                {item.descripcion ? <Text style={styles.productoDesc}>{item.descripcion}</Text> : null}
                <View style={styles.precioRow}>
                  {enPromo && <Text style={styles.precioTachado}>Bs {item.precio}</Text>}
                  <Text style={styles.precio}>Bs {enPromo ? item.precio_promocion : item.precio}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.agregarBtn}
                onPress={() => carrito?.agregar({ id: empresa.id, nombre: empresa.nombre }, item)}
              >
                <Ionicons name="add" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 },
  titulo: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subtitulo: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  descripcion: { paddingHorizontal: 20, paddingTop: 12, color: COLORS.text, fontSize: 13, lineHeight: 18 },
  horarioRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingTop: 8 },
  horarioTexto: { color: COLORS.muted, fontSize: 12 },
  carritoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  carritoBadgeTexto: { color: COLORS.white, fontWeight: "700", fontSize: 12 },
  lista: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 },
  vacio: { color: COLORS.muted, textAlign: "center", marginTop: 32 },
  producto: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  productoNombre: { fontWeight: "700", color: COLORS.text, fontSize: 15 },
  productoDesc: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  precioRow: { flexDirection: "row", gap: 8, marginTop: 6, alignItems: "baseline" },
  precioTachado: { color: COLORS.muted, fontSize: 12, textDecorationLine: "line-through" },
  precio: { color: COLORS.primary, fontWeight: "800", fontSize: 15 },
  agregarBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
