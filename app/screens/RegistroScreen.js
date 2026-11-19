import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import ProcedenciaSelector from "../components/ProcedenciaSelector";
import SelloAnimado from "../components/SelloAnimado";
import { COLORS } from "../constants/colors";
import { registro } from "../services/authService";

const INICIAL = {
  first_name: "",
  last_name: "",
  email: "",
  celular: "",
  ci: "",
  nit: "",
  dia: "",
  mes: "",
  anio: "",
  ocupacion: "",
  procedencia: "",
  ciudad_otra: "",
  password: "",
  password_confirmacion: "",
  acepta_terminos: false,
};

const OCUPACIONES = [
  { valor: "ESTUDIANTE", texto: "Estudiante de colegio", icono: "school-outline" },
  { valor: "UNIVERSITARIO", texto: "Universitario/a", icono: "library-outline" },
  { valor: "PROFESIONAL", texto: "Profesional", icono: "briefcase-outline" },
  { valor: "OTRO", texto: "Otro", icono: "person-outline" },
];
const EDAD_MINIMA = 10;

/** "AAAA-MM-DD" si día/mes/año forman una fecha real; si no, null. */
function fechaISO({ dia, mes, anio }) {
  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  const a = parseInt(anio, 10);
  if (!d || !m || !anio || anio.length !== 4) return null;
  const fecha = new Date(a, m - 1, d);
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function edadDe(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  const hoy = new Date();
  return hoy.getFullYear() - a - (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d) ? 1 : 0);
}

// Validación en el teléfono para respuesta inmediata; el backend vuelve a validar todo.
function validar(f) {
  const e = {};
  if (!f.first_name.trim()) e.first_name = "Ingresa tu nombre.";
  if (!f.last_name.trim()) e.last_name = "Ingresa tu apellido.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Ingresa un correo válido.";
  if (!/^(\+591)?[67]\d{7}$/.test(f.celular.trim())) e.celular = "8 dígitos, empieza con 6 o 7.";
  if (!/^\d{5,10}(-[0-9A-Za-z]{1,2})?$/.test(f.ci.trim())) e.ci = "Solo números; complemento opcional (ej. 1234567-1A).";
  if (f.nit && !/^\d{5,20}$/.test(f.nit.trim())) e.nit = "El NIT debe tener solo números.";
  const fecha = fechaISO(f);
  const edad = edadDe(fecha);
  if (!fecha) e.fecha_nacimiento = "Escribe tu fecha de nacimiento (día, mes y año).";
  else if (edad < 0) e.fecha_nacimiento = "La fecha no puede ser futura.";
  else if (edad < EDAD_MINIMA) e.fecha_nacimiento = `Debes tener al menos ${EDAD_MINIMA} años.`;
  else if (edad > 110) e.fecha_nacimiento = "Revisa el año.";
  if (!f.ocupacion) e.ocupacion = "Elige a qué te dedicas.";
  if (!f.procedencia) e.procedencia = "Elige de dónde eres.";
  else if (f.procedencia === "OTRO" && !f.ciudad_otra.trim()) e.ciudad_otra = "Escribe tu ciudad.";
  if (f.password.length < 8) e.password = "Mínimo 8 caracteres.";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Usa letras y números.";
  if (f.password !== f.password_confirmacion) e.password_confirmacion = "Las contraseñas no coinciden.";
  if (!f.acepta_terminos) e.acepta_terminos = "Debes aceptar los términos.";
  return e;
}

function Regla({ cumple, texto }) {
  return (
    <View style={styles.regla}>
      <Ionicons name={cumple ? "checkmark-circle" : "ellipse-outline"} size={14} color={cumple ? "#16A34A" : COLORS.muted} />
      <Text style={[styles.reglaTexto, cumple && { color: "#16A34A" }]}>{texto}</Text>
    </View>
  );
}

export default function RegistroScreen({ navigation }) {
  const [form, setForm] = useState(INICIAL);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const onSubmit = async () => {
    const e = validar(form);
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) {
      setErrorGeneral("Revisa los campos marcados.");
      return;
    }
    setLoading(true);
    try {
      const { dia, mes, anio, ...datos } = form;
      const paso = await registro({
        ...datos,
        email: form.email.trim().toLowerCase(),
        ci: form.ci.trim().toUpperCase(),
        nit: form.nit.trim(),
        fecha_nacimiento: fechaISO(form),
        ciudad_otra: form.procedencia === "OTRO" ? form.ciudad_otra.trim() : "",
      });
      navigation.replace("VerificarCodigo", paso);
    } catch (err) {
      setErrores(err.fieldErrors || {});
      setErrorGeneral(err.message);
    } finally {
      setLoading(false);
    }
  };

  const p = form.password;
  const edad = edadDe(fechaISO(form));
  const setFecha = (campo) => (valor) => {
    set(campo)(valor.replace(/\D/g, ""));
    if (errores.fecha_nacimiento) setErrores((e) => ({ ...e, fecha_nacimiento: undefined }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.sello}>
            <SelloAnimado size={84} />
          </View>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Suma puntos cada vez que visitas el Paseo y compras en sus tiendas.</Text>

          <Text style={styles.seccion}>Datos personales</Text>
          <FormField label="Nombre" value={form.first_name} onChangeText={set("first_name")}
            error={errores.first_name} autoComplete="given-name" />
          <FormField label="Apellido" value={form.last_name} onChangeText={set("last_name")}
            error={errores.last_name} autoComplete="family-name" />

          <Text style={styles.seccion}>Edad y ocupación</Text>
          <Text style={styles.label}>Fecha de nacimiento</Text>
          <View style={styles.fechaFila}>
            <View style={styles.fechaCampo}>
              <FormField label="Día" placeholder="DD" value={form.dia} onChangeText={setFecha("dia")}
                keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={styles.fechaCampo}>
              <FormField label="Mes" placeholder="MM" value={form.mes} onChangeText={setFecha("mes")}
                keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={[styles.fechaCampo, styles.fechaAnio]}>
              <FormField label="Año" placeholder="AAAA" value={form.anio} onChangeText={setFecha("anio")}
                keyboardType="number-pad" maxLength={4} />
            </View>
          </View>
          {errores.fecha_nacimiento ? (
            <Text style={styles.error}>{errores.fecha_nacimiento}</Text>
          ) : (
            <Text style={styles.ayuda}>
              {edad !== null && edad >= 0 ? `Tienes ${edad} años. ` : ""}Te regalamos monedas en tu cumpleaños.
            </Text>
          )}

          <Text style={[styles.label, styles.labelEspacio]}>¿A qué te dedicas?</Text>
          <View style={styles.ocupaciones}>
            {OCUPACIONES.map((o) => {
              const activa = form.ocupacion === o.valor;
              return (
                <TouchableOpacity key={o.valor} onPress={() => set("ocupacion")(o.valor)}
                  style={[styles.ocupacion, activa && styles.ocupacionActiva, errores.ocupacion && styles.ocupacionError]}
                  accessibilityRole="radio" accessibilityState={{ selected: activa }}>
                  <Ionicons name={o.icono} size={22} color={activa ? "#fff" : COLORS.primary} />
                  <Text style={[styles.ocupacionTexto, activa && styles.ocupacionTextoActivo]}>{o.texto}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errores.ocupacion ? <Text style={styles.error}>{errores.ocupacion}</Text> : (
            <Text style={styles.ayuda}>Así te mostramos eventos y promociones para ti.</Text>
          )}

          <Text style={styles.seccion}>Contacto</Text>
          <FormField label="Correo electrónico" placeholder="tu@correo.com" value={form.email}
            onChangeText={set("email")} error={errores.email} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email"
            hint="Te enviaremos un código para verificarlo." />
          <FormField label="Celular" placeholder="71234567" value={form.celular} onChangeText={set("celular")}
            error={errores.celular} keyboardType="phone-pad" autoComplete="tel" maxLength={12} />

          <Text style={styles.seccion}>Procedencia</Text>
          <ProcedenciaSelector
            value={{ procedencia: form.procedencia, ciudad_otra: form.ciudad_otra }}
            onChange={(v) => setForm({ ...form, ...v })}
            errores={errores}
          />

          <Text style={styles.seccion}>Identidad</Text>
          <View style={styles.aviso}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
            <Text style={styles.avisoTexto}>
              Tu carnet debe ser real y válido: te lo pediremos para entregarte premios y canjes.
            </Text>
          </View>
          <FormField label="Carnet de identidad (CI)" placeholder="1234567 o 1234567-1A" value={form.ci}
            onChangeText={set("ci")} error={errores.ci} autoCapitalize="characters" maxLength={13} />
          <FormField label="NIT (opcional)" value={form.nit} onChangeText={set("nit")} error={errores.nit}
            keyboardType="number-pad" hint="Lo usaremos por defecto al registrar tus compras." />

          <Text style={styles.seccion}>Seguridad</Text>
          <FormField label="Contraseña" secure value={form.password} onChangeText={set("password")}
            error={errores.password} autoComplete="new-password" />
          <View style={styles.reglas}>
            <Regla cumple={p.length >= 8} texto="Mínimo 8 caracteres" />
            <Regla cumple={/[A-Za-z]/.test(p)} texto="Al menos una letra" />
            <Regla cumple={/\d/.test(p)} texto="Al menos un número" />
          </View>
          <FormField label="Confirmar contraseña" secure value={form.password_confirmacion}
            onChangeText={set("password_confirmacion")} error={errores.password_confirmacion}
            autoComplete="new-password" />

          <View style={styles.terminos}>
            <Switch value={form.acepta_terminos} onValueChange={set("acepta_terminos")}
              trackColor={{ true: COLORS.secondary }} thumbColor={form.acepta_terminos ? COLORS.primary : undefined}
              accessibilityLabel="Acepto los términos y condiciones" />
            <Text style={styles.terminosTexto}>
              Acepto los términos y condiciones y la política de privacidad de Paseo Aranjuez.
            </Text>
          </View>
          {errores.acepta_terminos && <Text style={styles.error}>{errores.acepta_terminos}</Text>}

          {errorGeneral && <Text style={styles.errorGeneral}>{errorGeneral}</Text>}
          <PrimaryButton title="Crear cuenta" onPress={onSubmit} loading={loading} />

          <TouchableOpacity style={styles.link} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.linkText}>
              ¿Ya tienes cuenta? <Text style={styles.linkStrong}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  back: { marginBottom: 12, alignSelf: "flex-start" },
  sello: { alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.muted, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  labelEspacio: { marginTop: 14 },
  ayuda: { fontSize: 12, color: COLORS.muted, marginTop: 6, marginBottom: 8 },
  fechaFila: { flexDirection: "row", gap: 10 },
  fechaCampo: { flex: 1 },
  fechaAnio: { flex: 1.4 },
  ocupaciones: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ocupacion: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: "#CBD5E1", backgroundColor: "#fff" },
  ocupacionActiva: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  ocupacionError: { borderColor: COLORS.danger },
  ocupacionTexto: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text },
  ocupacionTextoActivo: { color: "#fff" },
  seccion: { fontSize: 13, fontWeight: "800", color: COLORS.primary, textTransform: "uppercase",
    letterSpacing: 0.6, marginTop: 18, marginBottom: 10 },
  aviso: { flexDirection: "row", gap: 8, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, marginBottom: 12 },
  avisoTexto: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 18 },
  reglas: { marginTop: -6, marginBottom: 14, gap: 3 },
  regla: { flexDirection: "row", alignItems: "center", gap: 6 },
  reglaTexto: { fontSize: 12, color: COLORS.muted },
  terminos: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  terminosTexto: { flex: 1, fontSize: 13, color: COLORS.text },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 5 },
  errorGeneral: { color: COLORS.danger, marginTop: 14, fontSize: 13, textAlign: "center" },
  link: { marginTop: 22, alignItems: "center" },
  linkText: { color: COLORS.muted, fontSize: 14 },
  linkStrong: { color: COLORS.primary, fontWeight: "700" },
});
