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
import { COLORS } from "../constants/colors";
import { registro } from "../services/authService";

const INICIAL = {
  first_name: "",
  last_name: "",
  email: "",
  celular: "",
  ci: "",
  nit: "",
  fecha_nacimiento: "",
  password: "",
  password_confirmacion: "",
  acepta_terminos: false,
};

// Validación en el teléfono para respuesta inmediata; el backend vuelve a validar todo.
function validar(f) {
  const e = {};
  if (!f.first_name.trim()) e.first_name = "Ingresa tu nombre.";
  if (!f.last_name.trim()) e.last_name = "Ingresa tu apellido.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Ingresa un correo válido.";
  if (!/^(\+591)?[67]\d{7}$/.test(f.celular.trim())) e.celular = "8 dígitos, empieza con 6 o 7.";
  if (!/^\d{5,10}(-[0-9A-Za-z]{1,2})?$/.test(f.ci.trim())) e.ci = "Solo números; complemento opcional (ej. 1234567-1A).";
  if (f.nit && !/^\d{5,20}$/.test(f.nit.trim())) e.nit = "El NIT debe tener solo números.";
  if (f.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_nacimiento)) e.fecha_nacimiento = "Usa el formato AAAA-MM-DD.";
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
      const paso = await registro({
        ...form,
        email: form.email.trim().toLowerCase(),
        ci: form.ci.trim().toUpperCase(),
        nit: form.nit.trim(),
        fecha_nacimiento: form.fecha_nacimiento || null,
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Suma puntos cada vez que visitas el Paseo y compras en sus tiendas.</Text>

          <Text style={styles.seccion}>Datos personales</Text>
          <FormField label="Nombre" value={form.first_name} onChangeText={set("first_name")}
            error={errores.first_name} autoComplete="given-name" />
          <FormField label="Apellido" value={form.last_name} onChangeText={set("last_name")}
            error={errores.last_name} autoComplete="family-name" />
          <FormField label="Fecha de nacimiento (opcional)" placeholder="AAAA-MM-DD"
            value={form.fecha_nacimiento} onChangeText={set("fecha_nacimiento")}
            error={errores.fecha_nacimiento} hint="Te regalamos puntos en tu cumpleaños."
            keyboardType="numbers-and-punctuation" maxLength={10} />

          <Text style={styles.seccion}>Contacto</Text>
          <FormField label="Correo electrónico" placeholder="tu@correo.com" value={form.email}
            onChangeText={set("email")} error={errores.email} autoCapitalize="none"
            keyboardType="email-address" autoComplete="email"
            hint="Te enviaremos un código para verificarlo." />
          <FormField label="Celular" placeholder="71234567" value={form.celular} onChangeText={set("celular")}
            error={errores.celular} keyboardType="phone-pad" autoComplete="tel" maxLength={12} />

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
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.muted, marginTop: 4, marginBottom: 8 },
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
