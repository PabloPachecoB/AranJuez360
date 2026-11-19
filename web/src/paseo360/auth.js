// Puente al AuthContext del panel: estas pantallas esperaban { user, salir }.
import { useAuth as useAuthPanel } from "../auth/AuthContext";

export function useAuth() {
  const { usuario, cerrarSesion } = useAuthPanel();
  return { user: usuario, salir: cerrarSesion };
}
