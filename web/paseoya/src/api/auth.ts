import { api, setTokens } from "./client";

export type Rol = "ADMIN" | "PORTERO" | "CLIENTE" | "NEGOCIO" | "CAJERO" | "OFICINA";

export interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  rol: Rol;
  empresa: number | null;
  empresa_nombre: string | null;
  puntos_saldo: number;
}

interface LoginResponse {
  paso: string;
  desafio: string;
  email: string;
  vence_en_minutos: number;
}

interface VerificarResponse {
  access: string;
  refresh: string;
  usuario: Usuario;
}

// Paso 1: email + password -> el backend manda un código de 6 dígitos por
// correo (en desarrollo se imprime en la consola del servidor) y devuelve un
// "desafío" (un id de esa solicitud de login, no un token todavía).
export function iniciarLogin(email: string, password: string) {
  return api<LoginResponse>("/auth/login/", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// Paso 2: desafío + código -> recién aquí llegan los JWT (access + refresh).
export async function verificarCodigo(desafio: string, codigo: string) {
  const data = await api<VerificarResponse>("/auth/verificar-codigo/", {
    method: "POST",
    body: { desafio, codigo },
    auth: false,
  });
  setTokens({ access: data.access, refresh: data.refresh });
  return data.usuario;
}

export function obtenerYo() {
  return api<Usuario>("/auth/yo/");
}

export function cerrarSesion() {
  setTokens(null);
}
