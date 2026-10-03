import { useState } from "react";
import type { ListaApi, Movimiento } from "../api";
import { CabeceraCliente, EstadoDatos } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { formatoFecha, formatoPuntos, lista } from "../utils";

const etiquetas: Record<Movimiento["tipo"], string> = { COMPRA: "Compra", VISITA: "Visita", ACTIVIDAD: "Actividad", CANJE: "Canje" };
const iconos: Record<Movimiento["tipo"], string> = { COMPRA: "shopping_bag", VISITA: "door_front", ACTIVIDAD: "celebration", CANJE: "redeem" };

export function ClienteMovimientosPage() {
  const movimientosApi = useClienteDatos<ListaApi<Movimiento>>("/puntos/movimientos/");
  const [tipo, setTipo] = useState("TODOS");
  const movimientos = lista(movimientosApi.data).filter((item) => tipo === "TODOS" || item.tipo === tipo);

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Actividad de la cuenta" titulo="Historial de movimientos" descripcion="Puntos sumados y canjes, ordenados desde el más reciente." />
      <label className="mb-5 flex max-w-xs flex-col gap-2 font-label-md text-label-md font-semibold">
        Tipo de movimiento
        <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="h-11 border border-outline-variant/60 bg-surface-container-lowest px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="TODOS">Todos</option><option value="COMPRA">Compras</option><option value="VISITA">Visitas</option><option value="ACTIVIDAD">Actividades</option><option value="CANJE">Canjes</option>
        </select>
      </label>
      <EstadoDatos cargando={movimientosApi.cargando} error={movimientosApi.error} vacio={!movimientos.length} onRetry={movimientosApi.recargar}>
        <div className="border-y border-outline-variant/50 bg-surface-container-lowest">
          {movimientos.map((movimiento) => {
            const positivo = Number(movimiento.puntos) >= 0;
            return (
              <article key={movimiento.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-outline-variant/30 px-3 py-4 last:border-b-0 sm:px-5">
                <span className={`grid h-10 w-10 place-items-center ${positivo ? "bg-secondary-fixed/60 text-secondary" : "bg-primary-fixed/50 text-primary"}`}><span className="material-symbols-outlined" aria-hidden="true">{iconos[movimiento.tipo]}</span></span>
                <div className="min-w-0"><p className="truncate font-label-md text-label-md font-bold">{movimiento.descripcion || etiquetas[movimiento.tipo]}</p><p className="mt-1 truncate font-body-sm text-body-sm text-on-surface-variant">{movimiento.empresa_nombre || etiquetas[movimiento.tipo]} · {formatoFecha(movimiento.creado_en, { dateStyle: "medium", timeStyle: "short" })}</p></div>
                <strong className={`whitespace-nowrap font-label-md text-label-md tabular-nums ${positivo ? "text-secondary" : "text-primary"}`}>{positivo ? "+" : "−"}{formatoPuntos(Math.abs(Number(movimiento.puntos)))} pts</strong>
              </article>
            );
          })}
        </div>
      </EstadoDatos>
    </div>
  );
}