import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listarPedidosEmpresa, type PedidoApi } from "../api/pedidos";
import { useAuth } from "../../auth/AuthContext";

interface PedidosContextValue {
  pedidos: PedidoApi[];
  cargando: boolean;
  recargar: () => Promise<void>;
}

const PedidosContext = createContext<PedidosContextValue | null>(null);

export function PedidosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoApi[]>([]);
  const [cargando, setCargando] = useState(true);

  async function recargar() {
    setCargando(true);
    try {
      setPedidos(await listarPedidosEmpresa());
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!usuario) {
      setCargando(false);
      return;
    }
    recargar();
    // Los pagos y las llegadas ocurren en la app del cliente: se consulta cada 6 s sin parpadear.
    const id = setInterval(() => {
      listarPedidosEmpresa().then(setPedidos).catch(() => {});
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  return (
    <PedidosContext.Provider value={{ pedidos, cargando, recargar }}>{children}</PedidosContext.Provider>
  );
}

export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error("usePedidos debe usarse dentro de PedidosProvider");
  return ctx;
}
