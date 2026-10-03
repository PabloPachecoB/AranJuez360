import { useMemo, useState, type FormEvent } from "react";
import { pedidoItemsIniciales, productosIniciales } from "../mockData";
import { usePedidos } from "../context/PedidosContext";
import { useNegocio } from "../context/NegocioContext";
import type { Negocio } from "../types";
import { Switch } from "../components/Switch";

const inputClase =
  "w-full h-12 px-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all";
const labelClase = "font-label-md text-label-md text-on-surface font-semibold";

export function NegocioPage() {
  const { pedidos } = usePedidos();
  const { negocio: negocioGuardado, setNegocio: setNegocioGuardado } = useNegocio();
  const [negocio, setNegocio] = useState<Negocio>(negocioGuardado);
  const [guardado, setGuardado] = useState(false);

  function actualizar<K extends keyof Negocio>(campo: K, valor: Negocio[K]) {
    setGuardado(false);
    setNegocio((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock: no hay backend todavía, solo confirmamos visualmente el guardado.
    setNegocioGuardado(negocio);
    setGuardado(true);
  }

  const resumenVentas = useMemo(() => {
    const entregados = pedidos.filter((p) => p.estado === "entregado");
    const totalVendido = entregados.reduce((suma, p) => suma + p.total, 0);
    const ticketPromedio = entregados.length ? totalVendido / entregados.length : 0;

    const cantidadPorProducto = new Map<string, number>();
    for (const pedido of entregados) {
      for (const item of pedidoItemsIniciales.filter((i) => i.pedido_id === pedido.id)) {
        cantidadPorProducto.set(
          item.producto_id,
          (cantidadPorProducto.get(item.producto_id) ?? 0) + item.cantidad
        );
      }
    }
    let productoTop: { nombre: string; cantidad: number } | null = null;
    for (const [productoId, cantidad] of cantidadPorProducto) {
      if (!productoTop || cantidad > productoTop.cantidad) {
        const producto = productosIniciales.find((p) => p.id === productoId);
        productoTop = { nombre: producto?.nombre ?? productoId, cantidad };
      }
    }

    return { totalVendido, pedidosEntregados: entregados.length, ticketPromedio, productoTop };
  }, [pedidos]);

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <span className="font-badge-code text-badge-code uppercase tracking-wider text-secondary px-2 py-0.5 rounded-full bg-secondary-container/40 w-fit">
            Gestión de Local
          </span>
          <h1 className="font-display text-display text-on-surface tracking-tight">Mi Negocio</h1>
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
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                  Producto estrella
                </span>
              </div>
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
                  Estos datos determinan la ficha oficial de tu local en la app de PaseoYa.
                </p>
              </div>
              <span className="material-symbols-outlined text-primary text-[24px]">edit_document</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className={labelClase}>Nombre comercial</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-[18px]">
                    store
                  </span>
                  <input
                    className={`${inputClase} pl-10`}
                    value={negocio.nombre}
                    onChange={(e) => actualizar("nombre", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClase}>Piso / Nivel</label>
                  <input className={inputClase} value={negocio.piso} onChange={(e) => actualizar("piso", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClase}>Local #</label>
                  <input className={inputClase} value={negocio.local} onChange={(e) => actualizar("local", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClase} flex items-center gap-1.5`}>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
                Horario de atención
              </label>
              <input className={inputClase} value={negocio.horario} onChange={(e) => actualizar("horario", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`${labelClase} flex items-center gap-1.5`}>
                <span className="material-symbols-outlined text-[16px] text-primary">navigation</span>
                Referencia de llegada
              </label>
              <input
                className={inputClase}
                value={negocio.referencia}
                onChange={(e) => actualizar("referencia", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClase}>Descripción del negocio</label>
              <textarea
                className="w-full p-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all resize-none"
                rows={3}
                value={negocio.descripcion}
                onChange={(e) => actualizar("descripcion", e.target.value)}
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
                    Visible para navegación de catálogo y recepción de pedidos en la app de PaseoYa.
                  </span>
                </div>
              </div>
              <Switch
                checked={negocio.activo}
                onChange={(activo) => actualizar("activo", activo)}
                label="Negocio activo"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm">
            {guardado && (
              <span className="font-label-md text-label-md text-secondary font-semibold">¡Cambios guardados!</span>
            )}
            <button
              type="submit"
              className="px-space-xl py-3 bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>Guardar cambios</span>
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
                  {negocio.referencia}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
                  {negocio.horario}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
