import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { obtenerMiEmpresa, actualizarMiEmpresa, type NegocioApi, type NegocioInput } from "../api/negocio";
import { useAuth } from "./AuthContext";

interface NegocioContextValue {
  negocio: NegocioApi | null;
  cargando: boolean;
  guardar: (datos: NegocioInput) => Promise<void>;
}

const NegocioContext = createContext<NegocioContextValue | null>(null);

export function NegocioProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [negocio, setNegocio] = useState<NegocioApi | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setCargando(false);
      return;
    }
    setCargando(true);
    obtenerMiEmpresa()
      .then(setNegocio)
      .finally(() => setCargando(false));
  }, [usuario]);

  async function guardar(datos: NegocioInput) {
    const actualizado = await actualizarMiEmpresa(datos);
    setNegocio(actualizado);
  }

  return (
    <NegocioContext.Provider value={{ negocio, cargando, guardar }}>{children}</NegocioContext.Provider>
  );
}

export function useNegocio() {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio debe usarse dentro de NegocioProvider");
  return ctx;
}
