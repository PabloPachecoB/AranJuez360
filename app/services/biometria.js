import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// "Acceso directo": tras el primer ingreso con código, la app guarda la sesión
// (refresh token en SecureStore) y la desbloquea con huella / Face ID.
const PREFERENCIA = "accesoBiometrico";

export async function biometriaDisponible() {
  try {
    const [hardware, registrada] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && registrada;
  } catch {
    return false;
  }
}

export async function accesoBiometricoActivo() {
  try {
    return (await SecureStore.getItemAsync(PREFERENCIA)) === "1";
  } catch {
    return false;
  }
}

export async function activarAccesoBiometrico(activo) {
  try {
    if (activo) await SecureStore.setItemAsync(PREFERENCIA, "1");
    else await SecureStore.deleteItemAsync(PREFERENCIA);
  } catch {
    // En web no hay SecureStore: el acceso directo simplemente no se ofrece.
  }
}

export async function autenticarConBiometria(mensaje = "Entra a Paseo Aranjuez 360") {
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: mensaje,
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
  });
  return resultado.success;
}
