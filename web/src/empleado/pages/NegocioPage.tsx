import { useMemo, useState, type FormEvent } from "react";
import { usePedidos } from "../context/PedidosContext";
import { useNegocio } from "../context/NegocioContext";
import { ApiError } from "../../api/client";
import type { NegocioInput } from "../api/negocio";
import { Switch } from "../components/Switch";

const inputClase =
  "w-full h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all";
const labelClase = "font-label-md text-label-md text-on-surface font-semibold";

export function NegocioPage() {
  const { pedidos } = usePedidos();
  const { negocio, cargando, guardar } = useNegocio();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumenVentas = useMemo(() => {
    const entregados = pedidos.filter((p) => p.estado === "ENTREGADO");
    const totalVendido = entregados.reduce((suma, p) => suma + Number(p.total), 0);
    const ticketPromedio = entregados.length ? totalVendido / entregados.length : 0;

    const cantidadPorProducto = new Map<string, number>();
    for (const pedido of entregados) {
      for (const item of pedido.items) {
        cantidadPorProducto.set(
          item.producto_nombre,
          (cantidadPorProducto.get(item.producto_nombre) ?? 0) + item.cantidad
        );
      }
    }
    let productoTop: { nombre: string; cantidad: number } | null = null;
    for (const [nombre, cantidad] of cantidadPorProducto) {
      if (!productoTop || cantidad > productoTop.cantidad) productoTop = { nombre, cantidad };
    }

    return { totalVendido, pedidosEntregados: entregados.length, ticketPromedio, productoTop };
  }, [pedidos]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!negocio) return;
    const form = new FormData(e.target as HTMLFormElement);
    const datos: NegocioInput = {
      telefono: String(form.get("telefono") ?? ""),
      descripcion: String(form.get("descripcion") ?? ""),
      piso: String(form.get("piso") ?? ""),
      local: String(form.get("local") ?? ""),
      referencia: String(form.get("referencia") ?? ""),
      activo: negocio.activo,
    };
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await guardar(datos);
      setGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(activo: boolean) {
    try {
      await guardar({ activo });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  if (cargando || !negocio) {
    return (
      <div className="flex items-center justify-center py-space-xl text-on-surface-variant font-body-md text-body-md">
        Cargando negocio...
      </div>
    );
  }

  const diasAbiertos = negocio.horarios.filter((h) => !h.cerrado);

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <span className="font-badge-code text-badge-code uppercase tracking-wider text-secondary px-2 py-0.5 rounded-full bg-secondary-container/40 w-fit">
            Gestión de Local
          </span>
          <h1 className="font-display text-display text-on-surface tracking-tight">{negocio.nombre}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Administra la presencia de tu marca y revisa el rendimiento de ventas por Click &amp; Collect.
          </p>
        </div>
      </div>

      {/* Resumen de ventas */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Resumen de ventas y rendimiento</h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Calculado a partir de tus pedidos entregados.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Total vendido</span>
              <div className="p-2.5 bg-primary-fixed/50 text-primary rounded-lg">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
            </div>
            <span className="font-price-display text-display text-on-surface tracking-tight mt-1">
              Bs {resumenVentas.totalVendido}
            </span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Pedidos entregados
              </span>
              <div className="p-2.5 bg-secondary-container/60 text-on-secondary-container rounded-lg">
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
              </div>
            </div>
            <span className="font-price-display text-display text-on-surface tracking-tight mt-1">
              {resumenVentas.pedidosEntregados}
            </span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Ticket promedio</span>
              <div className="p-2.5 bg-surface-container-high text-tertiary rounded-lg">
                <span className="material-symbols-outlined text-[20px]">receipt</span>
              </div>
            </div>
            <span className="font-price-display text-display text-on-surface tracking-tight mt-1">
              Bs {resumenVentas.ticketPromedio.toFixed(0)}
            </span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Producto estrella</span>
              <div className="p-2.5 bg-primary-fixed text-primary rounded-lg shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_cafe</span>
              </div>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface truncate mt-1">
              {resumenVentas.productoTop?.nombre ?? "—"}
            </span>
            {resumenVentas.productoTop && (
              <span className="font-label-sm text-label-sm text-primary font-bold">
                {resumenVentas.productoTop.cantidad} unidades
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Datos del negocio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <form className="lg:col-span-8 flex flex-col gap-space-md" onSubmit={handleSubmit}>
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Información comercial y localización
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Nombre, tipo y correo los administra Paseo Aranjuez; el resto lo completas tú.
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-[24px]">edit_document</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className={labelClase}>Teléfono</label>
                <input name="telefono" className={inputClase} defaultValue={negocio.telefono} />
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClase}>Piso / Nivel</label>
                  <input name="piso" className={inputClase} defaultValue={negocio.piso} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClase}>Local #</label>
                  <input name="local" className={inputClase} defaultValue={negocio.local} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClase} flex items-center gap-1.5`}>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
                Horario de atención
              </label>
              {diasAbiertos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {diasAbiertos.map((d) => (
                    <span
                      key={d.dia}
                      className="font-body-sm text-body-sm bg-surface-container-low px-2.5 py-1 rounded-full text-on-surface-variant"
                    >
                      {d.dia_nombre.slice(0, 3)} {d.abre}–{d.cierra}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-body-sm text-body-sm text-on-surface-variant">Sin horario configurado.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClase} flex items-center gap-1.5`}>
                <span className="material-symbols-outlined text-[16px] text-primary">navigation</span>
                Referencia de llegada
              </label>
              <input name="referencia" className={inputClase} defaultValue={negocio.referencia} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClase}>Descripción del negocio</label>
              <textarea
                name="descripcion"
                className="w-full p-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all resize-none"
                rows={3}
                defaultValue={negocio.descripcion}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">toggle_on</span>
              Visibilidad y estado operativo
            </h3>
            <div className="flex items-center justify-between p-space-md bg-surface-container-low rounded-lg">
              <div className="flex items-start gap-space-sm pr-space-md">
                <span className="material-symbols-outlined text-secondary text-[24px] mt-0.5">store</span>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    Negocio activo y abierto
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Visible para navegación de catálogo y recepción de pedidos en la app del Paseo (sección Comer).
                  </span>
                </div>
              </div>
              <Switch checked={negocio.activo} onChange={alternarActivo} label="Negocio activo" />
            </div>
          </div>

          {error && (
            <p className="font-body-sm text-body-sm text-error bg-error-container/40 rounded-lg px-space-md py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm">
            {guardado && (
              <span className="font-label-md text-label-md text-secondary font-semibold">¡Cambios guardados!</span>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="px-space-xl py-3 bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>{guardando ? "Guardando..." : "Guardar cambios"}</span>
            </button>
          </div>
        </form>

        {/* Vista previa para el cliente */}
        <div className="lg:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-space-md bg-surface-container-low flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                Vista previa para el cliente
              </span>
              {negocio.activo && (
                <span className="font-badge-code text-badge-code text-secondary bg-secondary-container/60 px-2 py-0.5 rounded-full font-bold">
                  En Línea
                </span>
              )}
            </div>
            <div className="p-space-md flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="w-14 h-14 rounded-xl bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-headline-md text-headline-md shadow-sm">
                  {negocio.nombre.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">{negocio.nombre}</h4>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Piso {negocio.piso} · Local {negocio.local}
                  </span>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{negocio.descripcion}</p>
              <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-1 text-on-surface-variant text-body-sm font-body-sm">
                <div className="flex items-center gap-1.5 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                  {negocio.referencia || "Sin referencia"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
