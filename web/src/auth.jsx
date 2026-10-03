import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setOnExpired, tokens } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  const salir = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setOnExpired(() => setUser(null));
    if (!tokens.access) {
      setCargando(false);
      return;
    }
    api("/auth/yo/")
      .then(setUser)
      .catch(salir)
      .finally(() => setCargando(false));
  }, [salir]);

  const iniciarSesion = useCallback(async (email, password) => {
    const data = await api("/auth/login/", { method: "POST", body: { email, password } });
    tokens.set(data);
    setUser(data.usuario);
    return data.usuario;
  }, []);

  return (
    <AuthContext.Provider value={{ user, cargando, iniciarSesion, salir }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
