import { api, ApiError } from "./apiClient";
import { setTokens } from "./tokenStorage";

// Flujo de acceso (todas las respuestas de paso 1 traen { paso, desafio, email }):
//   registro()  -> paso "verificar_correo"
//   login()     -> paso "codigo_login" (o "verificar_correo" si el correo no está verificado)
//   verificarCodigo(desafio, codigo) -> guarda tokens y devuelve el usuario

async function post(url, body) {
  try {
    const { data } = await api.post(url, body);
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}

export function registro(formulario) {
  return post("/auth/registro/", formulario);
}

export function login(email, password) {
  return post("/auth/login/", { email: email.trim().toLowerCase(), password });
}

export async function verificarCodigo(desafio, codigo) {
  const data = await post("/auth/verificar-codigo/", { desafio, codigo });
  await setTokens({ access: data.access, refresh: data.refresh });
  return data.usuario;
}

export function reenviarCodigo(desafio) {
  return post("/auth/reenviar-codigo/", { desafio });
}

export async function getMe() {
  try {
    const { data } = await api.get("/auth/yo/");
    return data;
  } catch (err) {
    throw new ApiError(err);
  }
}
