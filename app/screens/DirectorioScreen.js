import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { buscarProductos, listarCategorias, listarEmpresas } from "../services/empresasService";

export default function DirectorioScreen({ navigation }) {
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [resultadosProductos, setResultadosProductos] = useState(null); // null = sin búsqueda activa

  const cargarNegocios = useCallback(async (categoriaId) => {
    setCargando(true);
    try {
      setNegocios(await listarEmpresas({ categoria: categoriaId || undefined }));
    } catch {
      setNegocios([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    listarCategorias().then(setCategorias).catch(() => setCategorias([]));
    cargarNegocios(null);
  }, [cargarNegocios]);

  function elegirCategoria(id) {
    const nueva = categoriaActiva === id ? null : id;
    setCategoriaActiva(nueva);
    cargarNegocios(nueva);
  }

  async function buscar(valor) {
    setTexto(valor);
    if (!valor.trim()) {
      setResultadosProductos(null);
      return;
    }
    try {
      setResultadosProductos(await buscarProductos(valor.trim()));
    } catch {
      setResultadosProductos([]);
    }
  }

  const mostrandoBusqueda = resultadosProductos !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.titulo}>PaseoYa</Text>
        <Text style={styles.subtitulo}>Compra en el Paseo, recoge en persona</Text>
      </View>

      <View style={styles.buscador}>
        <Ionicons name="search-outline" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.buscadorInput}
          placeholder="Buscar un producto en todo el Paseo..."
          placeholderTextColor={COLORS.muted}
          value={texto}
          onChangeText={buscar}
        />
      </View>

      {mostrandoBusqueda ? (
        <FlatList
          data={resultadosProductos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={styles.vacio}>Nada con ese nombre por ahora.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productoResultado}
              onPress={() => navigation.navigate("NegocioDetalle", { empresaId: item.empresa })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.productoNombre}>{item.nombre}</Text>
                <Text style={styles.productoEmpresa}>
                  {item.empresa_nombre} · Piso {item.empresa_piso} · Local {item.empresa_local}
                </Text>
              </View>
              <Text style={styles.productoPrecio}>
                Bs {item.en_promocion && item.precio_promocion ? item.precio_promocion : item.precio}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categorias}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.chip, categoriaActiva === item.id && styles.chipActivo]}
                onPress={() => elegirCategoria(item.id)}
              >
                <Text style={[styles.chipTexto, categoriaActiva === item.id && styles.chipTextoActivo]}>
                  {item.nombre}
                </Text>
              </TouchableOpacity>
            )}
          />

          {cargando ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
          ) : (
            <FlatList
              data={negocios}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.lista}
              ListEmptyComponent={<Text style={styles.vacio}>No hay negocios en esta categoría todavía.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.negocio}
                  onPress={() => navigation.navigate("NegocioDetalle", { empresaId: item.id })}
                >
                  <View style={styles.negocioLogo}>
                    <Text style={styles.negocioInicial}>{item.nombre.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.negocioNombre}>{item.nombre}</Text>
                    <Text style={styles.negocioInfo}>
                      {item.categoria_nombre || "Sin categoría"} · Piso {item.piso || "-"} · Local{" "}
                      {item.local || "-"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  titulo: { fontSize: 26, fontWeight: "800", color: COLORS.text },
  subtitulo: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    gap: 8,
  },
  buscadorInput: { flex: 1, paddingVertical: 12, color: COLORS.text, fontSize: 15 },
  chips: { paddingHorizontal: 24, paddingVertical: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { color: COLORS.text, fontWeight: "600", fontSize: 13 },
  chipTextoActivo: { color: COLORS.white },
  lista: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  vacio: { color: COLORS.muted, textAlign: "center", marginTop: 32 },
  negocio: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  negocioLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  negocioInicial: { color: COLORS.white, fontWeight: "800", fontSize: 18 },
  negocioNombre: { fontWeight: "700", color: COLORS.text, fontSize: 15 },
  negocioInfo: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  productoResultado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
  },
  productoNombre: { fontWeight: "700", color: COLORS.text, fontSize: 15 },
  productoEmpresa: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  productoPrecio: { fontWeight: "800", color: COLORS.primary, fontSize: 15 },
});
