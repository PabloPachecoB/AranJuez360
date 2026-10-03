import { createContext, useContext, type ReactNode } from "react";
import { pedidosIniciales } from "../mockData";
import { usePersistentState } from "../hooks/usePersistentState";
import type { Pedido } from "../types";

interface PedidosContextValue {
  pedidos: Pedido[];
  setPedidos: React.Dispatch<React.SetStateAction<Pedido[]>>;
}

const PedidosContext = createContext<PedidosContextValue | null>(null);

export function PedidosProvider({ children }: { children: ReactNode }) {
  const [pedidos, setPedidos] = usePersistentState<Pedido[]>("paseoya_pedidos", pedidosIniciales);
  return (
    <PedidosContext.Provider value={{ pedidos, setPedidos }}>{children}</PedidosContext.Provider>
  );
}

export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error("usePedidos debe usarse dentro de PedidosProvider");
  return ctx;
}
