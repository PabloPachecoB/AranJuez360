import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SidebarContextValue {
  abierto: boolean;
  alternar: () => void;
  cerrar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  const alternar = useCallback(() => setAbierto((actual) => !actual), []);
  const value = useMemo(() => ({ abierto, alternar, cerrar }), [abierto, alternar, cerrar]);

  useEffect(() => {
    if (!abierto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto, cerrar]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar debe usarse dentro de SidebarProvider");
  return context;
}
