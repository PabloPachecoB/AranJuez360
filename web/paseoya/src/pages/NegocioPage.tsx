import { useMemo, useState, type FormEvent } from "react";
import { negocioActual as negocioInicial, pedidoItemsIniciales, productosIniciales } from "../mockData";
import { usePedidos } from "../context/PedidosContext";
import type { Negocio } from "../types";

export function NegocioPage() {
  const { pedidos } = usePedidos();
  const [negocio, setNegocio] = useState<Negocio>(negocioInicial);
  const [guardado, setGuardado] = useState(false);

  function actualizar<K extends keyof Negocio>(campo: K, valor: Negocio[K]) {
    setGuardado(false);
    setNegocio((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock: no hay backend todavía, solo confirmamos visualmente el guardado.
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

    return {
      totalVendido,
      pedidosEntregados: entregados.length,
      ticketPromedio,
      productoTop,
    };
  }, [pedidos]);

  return (
    <div className="pagina">
      <div className="pagina-encabezado">
        <h1>Mi negocio</h1>
      </div>

      <h2 className="seccion-titulo">Resumen de ventas</h2>
      <p className="nota-calculo">
        Calculado a partir de tus pedidos entregados — no requiere una ruta de backend nueva.
      </p>
      <div className="stats-grid">
        <div className="stat-tile">
          <span className="stat-valor">Bs {resumenVentas.totalVendido}</span>
          <span className="stat-etiqueta">Total vendido</span>
        </div>
        <div className="stat-tile">
          <span className="stat-valor">{resumenVentas.pedidosEntregados}</span>
          <span className="stat-etiqueta">Pedidos entregados</span>
        </div>
        <div className="stat-tile">
          <span className="stat-valor">Bs {resumenVentas.ticketPromedio.toFixed(0)}</span>
          <span className="stat-etiqueta">Ticket promedio</span>
        </div>
        <div className="stat-tile">
          <span className="stat-valor">{resumenVentas.productoTop?.nombre ?? "—"}</span>
          <span className="stat-etiqueta">
            Producto más vendido{resumenVentas.productoTop ? ` (${resumenVentas.productoTop.cantidad})` : ""}
          </span>
        </div>
      </div>

      <h2 className="seccion-titulo">Datos del negocio</h2>
      <form className="tarjeta-form" onSubmit={handleSubmit}>
        <div className="campo-fila">
          <label className="campo">
            Nombre
            <input value={negocio.nombre} onChange={(e) => actualizar("nombre", e.target.value)} />
          </label>
          <label className="campo">
            Horario
            <input value={negocio.horario} onChange={(e) => actualizar("horario", e.target.value)} />
          </label>
        </div>

        <label className="campo">
          Descripción
          <textarea
            value={negocio.descripcion}
            onChange={(e) => actualizar("descripcion", e.target.value)}
          />
        </label>

        <div className="campo-fila">
          <label className="campo">
            Piso
            <input value={negocio.piso} onChange={(e) => actualizar("piso", e.target.value)} />
          </label>
          <label className="campo">
            Local
            <input value={negocio.local} onChange={(e) => actualizar("local", e.target.value)} />
          </label>
        </div>

        <label className="campo">
          Referencia (cómo llegar)
          <input value={negocio.referencia} onChange={(e) => actualizar("referencia", e.target.value)} />
        </label>

        <label className="campo-checkbox">
          <input
            type="checkbox"
            checked={negocio.activo}
            onChange={(e) => actualizar("activo", e.target.checked)}
          />
          Negocio activo (visible en PaseoYa)
        </label>

        <div className="modal-acciones">
          {guardado && <span className="mensaje-ok">Guardado.</span>}
          <button type="submit" className="btn btn-primario">
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
