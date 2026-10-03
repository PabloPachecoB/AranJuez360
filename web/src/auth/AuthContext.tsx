import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getTokens } from "../api/client";
import { obtenerYo, cerrarSesion as cerrarSesionApi, type Usuario } from "../api/auth";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  setUsuario: (u: Usuario | null) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Si ya hay un access token guardado (de una sesión anterior), lo
    // validamos pidiendo el perfil en vez de obligar a hacer login de nuevo.
    const { accessToken } = getTokens();
    if (!accessToken) {
      setCargando(false);
      return;
    }
    obtenerYo()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  function cerrarSesion() {
    cerrarSesionApi();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, setUsuario, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
