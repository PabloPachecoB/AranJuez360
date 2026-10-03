import { useMemo, useState, type FormEvent } from "react";
import { usePedidos } from "../context/PedidosContext";
import { useNegocio } from "../context/NegocioContext";
import { avanzarPedido, cancelarPedido, validarRetiro, type EstadoPedidoApi, type PedidoApi } from "../api/pedidos";
import { ApiError } from "../api/client";

const ETIQUETA_ACCION: Partial<Record<EstadoPedidoApi, string>> = {
  RECIBIDO: "Confirmar pedido",
  CONFIRMADO: "Empezar a preparar",
  PREPARANDO: "Marcar listo para recoger",
};

const ICONO_ACCION: Partial<Record<EstadoPedidoApi, string>> = {
  RECIBIDO: "soup_kitchen",
  CONFIRMADO: "soup_kitchen",
  PREPARANDO: "notification_important",
};

const CLASE_ESTADO: Record<EstadoPedidoApi, string> = {
  RECIBIDO: "bg-tertiary-fixed text-on-tertiary-fixed",
  CONFIRMADO: "bg-tertiary-fixed text-on-tertiary-fixed",
  PREPARANDO: "bg-primary-fixed text-on-primary-fixed-variant",
  LISTO_PARA_RECOGER: "bg-primary text-on-primary",
  ENTREGADO: "bg-secondary-container text-on-secondary-container",
  CANCELADO: "bg-error-container text-on-error-container",
};

const SE_PUEDE_CANCELAR: EstadoPedidoApi[] = ["RECIBIDO", "CONFIRMADO", "PREPARANDO"];

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function resumenItems(pedido: PedidoApi) {
  return pedido.items.map((item) => `${item.cantidad}x ${item.producto_nombre}`).join(", ");
}

function esHoy(fechaIso: string) {
  const fecha = new Date(fechaIso);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

export function PedidosPage() {
  const { pedidos, recargar } = usePedidos();
  const { negocio } = useNegocio();
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [validando, setValidando] = useState(false);
  const [mensajeValidacion, setMensajeValidacion] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );
  const [accionEnCurso, setAccionEnCurso] = useState<number | null>(null);

  const pedidosActivos = useMemo(
    () => pedidos.filter((p) => p.estado !== "ENTREGADO" && p.estado !== "CANCELADO"),
    [pedidos]
  );
  const pedidosFinalizados = useMemo(
    () => pedidos.filter((p) => p.estado === "ENTREGADO" || p.estado === "CANCELADO"),
    [pedidos]
  );

  const kpis = useMemo(() => {
    const porPreparar = pedidosActivos.filter((p) => p.estado !== "LISTO_PARA_RECOGER").length;
    const listos = pedidosActivos.filter((p) => p.estado === "LISTO_PARA_RECOGER").length;
    const entregadosHoy = pedidos.filter((p) => p.estado === "ENTREGADO" && p.entregado_en && esHoy(p.entregado_en));
    const facturadoHoy = entregadosHoy.reduce((suma, p) => suma + Number(p.total), 0);
    return { porPreparar, listos, entregadosHoy: entregadosHoy.length, facturadoHoy };
  }, [pedidos, pedidosActivos]);

  async function onAvanzar(pedido: PedidoApi) {
    setAccionEnCurso(pedido.id);
    try {
      await avanzarPedido(pedido.id);
      await recargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo avanzar el pedido.");
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function onCancelar(pedido: PedidoApi) {
    if (!confirm(`¿Cancelar el pedido ${pedido.codigo_retiro}?`)) return;
    setAccionEnCurso(pedido.id);
    try {
      await cancelarPedido(pedido.id);
      await recargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo cancelar el pedido.");
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function onValidarRetiro(e: FormEvent) {
    e.preventDefault();
    setValidando(true);
    setMensajeValidacion(null);
    try {
      const pedido = await validarRetiro(codigoIngresado.trim());
      await recargar();
      setMensajeValidacion({
        tipo: "ok",
        texto: `¡Código ${pedido.codigo_retiro} verificado! Pedido entregado a ${pedido.cliente_nombre}.`,
      });
      setCodigoIngresado("");
    } catch (err) {
      setMensajeValidacion({
        tipo: "error",
        texto: err instanceof ApiError ? err.message : "No se pudo validar el código.",
      });
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div>
          {negocio && (
            <div className="flex items-center gap-space-xs text-on-surface-variant mb-1">
              <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">
                Piso {negocio.piso} · Local {negocio.local}
              </span>
            </div>
          )}
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Gestión de Retiros</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Atiende los pedidos entrantes y valida el retiro Click &amp; Collect en el local.
          </p>
        </div>
      </div>

      {/* Banner de validación */}
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg relative z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed mb-space-sm">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span className="font-badge-code text-badge-code uppercase tracking-wider">Mostrador y Despacho</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Validar retiro de cliente
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Escribe el código de retiro del voucher digital de PaseoYa para liberar el pedido al cliente.
            </p>
          </div>
          <form
            onSubmit={onValidarRetiro}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm w-full lg:w-auto"
          >
            <div className="relative min-w-[260px] flex-1 sm:flex-initial">
              <span className="material-symbols-outlined absolute left-3.5 top-3 text-outline text-[20px]">
                qr_code_scanner
              </span>
              <input
                className="w-full pl-11 pr-4 py-3 bg-surface-container-low rounded-xl font-headline-sm text-headline-sm uppercase text-on-surface placeholder:text-outline placeholder:font-body-md placeholder:normal-case focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-inner transition-all"
                placeholder="Código ej. BD069AC6"
                value={codigoIngresado}
                onChange={(e) => setCodigoIngresado(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={validando}
              className="flex items-center justify-center gap-space-xs px-space-lg py-3 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md hover:bg-primary-container active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span className="whitespace-nowrap">{validando ? "Validando..." : "Validar y Entregar"}</span>
            </button>
          </form>
        </div>
        {mensajeValidacion && (
          <div
            className={`mt-space-md p-space-sm rounded-lg flex items-center justify-between ${
              mensajeValidacion.tipo === "ok"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px]">
                {mensajeValidacion.tipo === "ok" ? "task_alt" : "error"}
              </span>
              <span className="font-label-md text-label-md">{mensajeValidacion.texto}</span>
            </div>
            <button type="button" className="hover:opacity-70" onClick={() => setMensajeValidacion(null)}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
      </div>

      {/* KPIs operativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-on-surface-variant">Por preparar</span>
            <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[18px]">soup_kitchen</span>
            </div>
          </div>
          <span className="font-display text-display text-on-surface font-extrabold">{kpis.porPreparar}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-on-surface-variant">Listos para retiro</span>
            <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            </div>
          </div>
          <span className="font-display text-display text-primary font-extrabold">{kpis.listos}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-on-surface-variant">Entregados hoy</span>
            <div className="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">done_all</span>
            </div>
          </div>
          <span className="font-display text-display text-secondary font-extrabold">{kpis.entregadosHoy}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-on-surface-variant">Facturado hoy</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <span className="font-display text-display text-on-surface font-extrabold">Bs {kpis.facturadoHoy}</span>
        </div>
      </div>

      {/* Pedidos entrantes */}
      <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="p-space-lg flex items-center gap-space-sm">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <h3 className="font-headline-md text-headline-md text-on-surface">Pedidos entrantes y en preparación</h3>
          <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-badge-code text-badge-code uppercase font-bold">
            {pedidosActivos.length} activos
          </span>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant">
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Código</th>
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Cliente</th>
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Comanda</th>
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Total</th>
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Estado</th>
                <th className="py-3.5 px-space-md font-badge-code text-badge-code uppercase tracking-wider text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {pedidosActivos.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-surface-container-low/50 transition-colors border-b border-surface-container">
                  <td className="py-4 px-space-md">
                    <span className="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">
                      {pedido.codigo_retiro}
                    </span>
                  </td>
                  <td className="py-4 px-space-md">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-headline-sm text-headline-sm">
                        {iniciales(pedido.cliente_nombre)}
                      </div>
                      <span className="font-label-md text-label-md font-bold text-on-surface">
                        {pedido.cliente_nombre}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-space-md max-w-xs">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{resumenItems(pedido)}</span>
                  </td>
                  <td className="py-4 px-space-md">
                    <span className="font-price-display text-price-display text-on-surface">Bs {pedido.total}</span>
                  </td>
                  <td className="py-4 px-space-md">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm font-bold ${CLASE_ESTADO[pedido.estado]}`}
                    >
                      {pedido.estado_display}
                    </span>
                  </td>
                  <td className="py-4 px-space-md text-right">
                    <div className="flex items-center justify-end gap-space-xs">
                      {ETIQUETA_ACCION[pedido.estado] && (
                        <button
                          disabled={accionEnCurso === pedido.id}
                          className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-xs transition-all flex items-center gap-1 disabled:opacity-60"
                          onClick={() => onAvanzar(pedido)}
                        >
                          <span className="material-symbols-outlined text-[16px]">{ICONO_ACCION[pedido.estado]}</span>
                          {ETIQUETA_ACCION[pedido.estado]}
                        </button>
                      )}
                      {pedido.estado === "LISTO_PARA_RECOGER" && (
                        <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                          Esperando código del cliente
                        </span>
                      )}
                      {SE_PUEDE_CANCELAR.includes(pedido.estado) && (
                        <button
                          disabled={accionEnCurso === pedido.id}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors disabled:opacity-60"
                          onClick={() => onCancelar(pedido)}
                          title="Cancelar"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pedidosActivos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-space-lg text-center text-on-surface-variant font-body-md text-body-md">
                    No hay pedidos entrantes por ahora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial */}
      {pedidosFinalizados.length > 0 && (
        <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[22px]">history</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Historial reciente</h3>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant">
                  <th className="py-3 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Código</th>
                  <th className="py-3 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Cliente</th>
                  <th className="py-3 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Total</th>
                  <th className="py-3 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Estado</th>
                  <th className="py-3 px-space-md font-badge-code text-badge-code uppercase tracking-wider">Hora</th>
                </tr>
              </thead>
              <tbody className="text-on-surface font-body-md text-body-md">
                {pedidosFinalizados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-surface-container-low/40 transition-colors border-b border-surface-container last:border-b-0">
                    <td className="py-3.5 px-space-md font-badge-code text-badge-code font-bold text-on-surface">
                      {pedido.codigo_retiro}
                    </td>
                    <td className="py-3.5 px-space-md">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {pedido.cliente_nombre}
                      </span>
                    </td>
                    <td className="py-3.5 px-space-md font-price-sm text-price-sm">Bs {pedido.total}</td>
                    <td className="py-3.5 px-space-md">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${CLASE_ESTADO[pedido.estado]}`}
                      >
                        {pedido.estado_display}
                      </span>
                    </td>
                    <td className="py-3.5 px-space-md font-body-sm text-body-sm text-on-surface-variant">
                      {pedido.entregado_en ? new Date(pedido.entregado_en).toLocaleString("es-BO") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
