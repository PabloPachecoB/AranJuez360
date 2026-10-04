import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setSessionExpiredHandler } from "../services/apiClient";
import { getMe } from "../services/authService";
import {
  accesoBiometricoActivo,
  activarAccesoBiometrico,
  autenticarConBiometria,
} from "../services/biometria";
import { clearTokens, getRefreshToken } from "../services/tokenStorage";

// estado: "cargando" -> al abrir la app
//         "bloqueado" -> hay sesión guardada y acceso con huella activo
//         "invitado"  -> sin sesión (login / registro)
//         "autenticado"
const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [estado, setEstado] = useState("cargando");
  const [user, setUser] = useState(null);

  const cerrarSesion = useCallback(async () => {
    await clearTokens();
    await activarAccesoBiometrico(false);
    setUser(null);
    setEstado("invitado");
  }, []);

  const cargarPerfil = useCallback(async () => {
    try {
      setUser(await getMe());
      setEstado("autenticado");
    } catch {
      // Sin conexión o sesión vencida: volver al login.
      await cerrarSesion();
    }
  }, [cerrarSesion]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setEstado("invitado");
    });
    (async () => {
      const refresh = await getRefreshToken().catch(() => null);
      if (!refresh) return setEstado("invitado");
      if (await accesoBiometricoActivo()) return setEstado("bloqueado");
      await cargarPerfil();
    })();
    return () => setSessionExpiredHandler(null);
  }, [cargarPerfil]);

  /** Tras validar el código: el usuario ya viene en la respuesta. */
  const iniciarSesion = useCallback((usuario) => {
    setUser(usuario);
    setEstado("autenticado");
  }, []);

  const desbloquear = useCallback(async () => {
    if (await autenticarConBiometria()) await cargarPerfil();
  }, [cargarPerfil]);

  const value = useMemo(
    () => ({
      estado,
      user,
      iniciarSesion,
      desbloquear,
      recargarPerfil: cargarPerfil,
      cerrarSesion,
    }),
    [estado, user, iniciarSesion, desbloquear, cargarPerfil, cerrarSesion]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUserContext = () => useContext(UserContext);
