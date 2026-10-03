import { createContext, useContext, type ReactNode } from "react";
import { negocioActual } from "../mockData";
import { usePersistentState } from "../hooks/usePersistentState";
import type { Negocio } from "../types";

interface NegocioContextValue {
  negocio: Negocio;
  setNegocio: React.Dispatch<React.SetStateAction<Negocio>>;
}

const NegocioContext = createContext<NegocioContextValue | null>(null);

export function NegocioProvider({ children }: { children: ReactNode }) {
  const [negocio, setNegocio] = usePersistentState<Negocio>("paseoya_negocio", negocioActual);
  return (
    <NegocioContext.Provider value={{ negocio, setNegocio }}>{children}</NegocioContext.Provider>
  );
}

export function useNegocio() {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio debe usarse dentro de NegocioProvider");
  return ctx;
}
