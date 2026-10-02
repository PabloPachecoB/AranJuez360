import { useMemo, useState, type FormEvent } from "react";
import {
  clientesMock,
  pedidoItemsIniciales,
  pedidosIniciales,
  productosIniciales,
} from "../mockData";
import type { EstadoPedido, Pedido } from "../types";

const SIGUIENTE_ESTADO: Partial<Record<EstadoPedido, EstadoPedido>> = {
  recibido: "confirmado",
  confirmado: "preparando",
  preparando: "listo_para_recoger",
};

const ETIQUETA_ACCION: Partial<Record<EstadoPedido, string>> = {
  recibido: "Confirmar pedido",
  confirmado: "Empezar a preparar",
  preparando: "Marcar listo para recoger",
};

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  recibido: "Recibido",
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo_para_recoger: "Listo para recoger",
  cliente_llego: "Cliente llegó",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const CLASE_ESTADO: Record<EstadoPedido, string> = {
  recibido: "badge-recibido",
  confirmado: "badge-confirmado",
  preparando: "badge-preparando",
  listo_para_recoger: "badge-listo",
  cliente_llego: "badge-listo",
  entregado: "badge-entregado",
  cancelado: "badge-cancelado",
};

const SE_PUEDE_CANCELAR: EstadoPedido[] = ["recibido", "confirmado", "preparando"];

function nombreCliente(clienteId: string) {
  return clientesMock[clienteId]?.nombre ?? clienteId;
}

function resumenItems(pedidoId: string) {
  return pedidoItemsIniciales
    .filter((item) => item.pedido_id === pedidoId)
    .map((item) => {
      const producto = productosIniciales.find((p) => p.id === item.producto_id);
      return `${item.cantidad}x ${producto?.nombre ?? item.producto_id}`;
    })
    .join(", ");
}

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [mensajeValidacion, setMensajeValidacion] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );

  const pedidosActivos = useMemo(
    () => pedidos.filter((p) => p.estado !== "entregado" && p.estado !== "cancelado"),
    [pedidos]
  );
  const pedidosFinalizados = useMemo(
    () => pedidos.filter((p) => p.estado === "entregado" || p.estado === "cancelado"),
    [pedidos]
  );

  function avanzarEstado(pedido: Pedido) {
    const siguiente = SIGUIENTE_ESTADO[pedido.estado];
    if (!siguiente) return;
    setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: siguiente } : p)));
  }

  function cancelarPedido(pedido: Pedido) {
    if (!confirm(`¿Cancelar el pedido ${pedido.codigo_retiro}?`)) return;
    setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: "cancelado" } : p)));
  }

  function validarRetiro(e: FormEvent) {
    e.preventDefault();
    const codigo = codigoIngresado.trim().toUpperCase();
    const pedido = pedidos.find((p) => p.codigo_retiro.toUpperCase() === codigo);

    if (!pedido) {
      setMensajeValidacion({ tipo: "error", texto: "No se encontró ningún pedido con ese código." });
      return;
    }
    if (pedido.estado !== "listo_para_recoger" && pedido.estado !== "cliente_llego") {
      setMensajeValidacion({
        tipo: "error",
        texto: `El pedido ${pedido.codigo_retiro} todavía está "${ETIQUETA_ESTADO[pedido.estado]}", no está listo para entregar.`,
      });
      return;
    }

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedido.id ? { ...p, estado: "entregado", entregado_en: new Date().toISOString() } : p
      )
    );
    setMensajeValidacion({
      tipo: "ok",
      texto: `Pedido ${pedido.codigo_retiro} entregado a ${nombreCliente(pedido.cliente_id)}. Puntos sumados.`,
    });
    setCodigoIngresado("");
  }

  return (
    <div className="pagina">
      <div className="pagina-encabezado">
        <h1>Pedidos</h1>
      </div>

      <form className="validar-retiro" onSubmit={validarRetiro}>
        <div className="validar-retiro-texto">
          <h2>Validar retiro</h2>
          <p>Escanea o escribe el código de retiro del cliente para marcar el pedido como entregado.</p>
        </div>
        <div className="validar-retiro-controles">
          <input
            className="buscador"
            placeholder="Código de retiro, ej. PY-4821"
            value={codigoIngresado}
            onChange={(e) => setCodigoIngresado(e.target.value)}
          />
          <button type="submit" className="btn btn-primario">
            Validar
          </button>
        </div>
        {mensajeValidacion && (
          <p className={mensajeValidacion.tipo === "ok" ? "mensaje-ok" : "mensaje-error"}>
            {mensajeValidacion.texto}
          </p>
        )}
      </form>

      <h2 className="seccion-titulo">Pedidos entrantes</h2>
      <table className="tabla-productos">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Items</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pedidosActivos.map((pedido) => (
            <tr key={pedido.id}>
              <td className="codigo-retiro">{pedido.codigo_retiro}</td>
              <td>{nombreCliente(pedido.cliente_id)}</td>
              <td className="descripcion-producto">{resumenItems(pedido.id)}</td>
              <td>Bs {pedido.total}</td>
              <td>
                <span className={`badge ${CLASE_ESTADO[pedido.estado]}`}>
                  {ETIQUETA_ESTADO[pedido.estado]}
                </span>
              </td>
              <td>
                {ETIQUETA_ACCION[pedido.estado] && (
                  <button className="btn-texto" onClick={() => avanzarEstado(pedido)}>
                    {ETIQUETA_ACCION[pedido.estado]}
                  </button>
                )}
                {SE_PUEDE_CANCELAR.includes(pedido.estado) && (
                  <button className="btn-texto btn-peligro" onClick={() => cancelarPedido(pedido)}>
                    Cancelar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {pedidosActivos.length === 0 && (
            <tr>
              <td colSpan={6} className="tabla-vacia">
                No hay pedidos entrantes por ahora.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pedidosFinalizados.length > 0 && (
        <>
          <h2 className="seccion-titulo">Historial reciente</h2>
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Entregado</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFinalizados.map((pedido) => (
                <tr key={pedido.id}>
                  <td className="codigo-retiro">{pedido.codigo_retiro}</td>
                  <td>{nombreCliente(pedido.cliente_id)}</td>
                  <td>Bs {pedido.total}</td>
                  <td>
                    <span className={`badge ${CLASE_ESTADO[pedido.estado]}`}>
                      {ETIQUETA_ESTADO[pedido.estado]}
                    </span>
                  </td>
                  <td>
                    {pedido.entregado_en ? new Date(pedido.entregado_en).toLocaleString("es-BO") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
