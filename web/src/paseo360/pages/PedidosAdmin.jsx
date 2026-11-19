import { useEffect, useState } from "react";
import { qs } from "../api";
import { Estado, useApi } from "../ui";
import { bs, fecha } from "../format";

const FILTROS = [
  ["", "Todos"], ["PENDIENTE_PAGO", "Sin pagar"], ["RECIBIDO", "Pagados"], ["PREPARANDO", "Preparando"],
  ["LISTO_PARA_RECOGER", "Listos"], ["CLIENTE_LLEGO", "En el Paseo"], ["ENTREGADO", "Entregados"], ["CANCELADO", "Cancelados"],
];
const CLASE = {
  PENDIENTE_PAGO: "", RECIBIDO: "", CONFIRMADO: "", PREPARANDO: "", LISTO_PARA_RECOGER: "on", CLIENTE_LLEGO: "on",
  ENTREGADO: "on", CANCELADO: "off",
};
const hora = (iso) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Supervisión de PaseoYa: todos los pedidos de comida de todos los negocios, con su estado en vivo. */
export default function PedidosAdmin() {
  const [estado, setEstado] = useState("");
  const [buscar, setBuscar] = useState("");
  const lista = useApi(`/admin/pedidos/${qs({ estado, buscar })}`);
  const resumen = useApi("/admin/pedidos/resumen/");

  // Los clientes pagan y los negocios avanzan desde otros dispositivos: se actualiza solo cada 6 s.
  useEffect(() => {
    const id = setInterval(() => { lista.recargar(); resumen.recargar(); }, 6000);
    return () => clearInterval(id);
  }, [lista.recargar, resumen.recargar]);

  const filas = lista.data?.results || [];
  const por = resumen.data?.por_estado || {};
  const enCurso = ["RECIBIDO", "CONFIRMADO", "PREPARANDO"].reduce((s, e) => s + (por[e] || 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos y retiros</h1>
          <p>Todo lo que piden los clientes en los restaurantes del Paseo. Retiro presencial: no hay delivery. Se actualiza solo.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div className="card tile"><div className="label">Pedidos</div><div className="value">{resumen.data?.pedidos ?? "—"}</div></div>
        <div className="card tile"><div className="label">Sin pagar</div><div className="value">{por.PENDIENTE_PAGO ?? "—"}</div></div>
        <div className="card tile"><div className="label">En cocina</div><div className="value">{resumen.data ? enCurso : "—"}</div></div>
        <div className="card tile"><div className="label">Listos / en el Paseo</div>
          <div className="value">{resumen.data ? (por.LISTO_PARA_RECOGER || 0) + (por.CLIENTE_LLEGO || 0) : "—"}</div></div>
        <div className="card tile"><div className="label">Vendido (pagado)</div><div className="value">{resumen.data ? bs(resumen.data.vendido) : "—"}</div></div>
      </div>

      <div className="filters">
        <div className="segmented">
          {FILTROS.map(([k, t]) => <button key={k} aria-pressed={estado === k} onClick={() => setEstado(k)}>{t}</button>)}
        </div>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar código, negocio o cliente…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} />
      </div>

      <div className="card">
        <Estado cargando={lista.cargando && !lista.data} error={lista.error} vacio={false}>
          {filas.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Pedido</th><th>Negocio</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Retiro</th><th>Estado</th>
                </tr></thead>
                <tbody>
                  {filas.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.codigo_retiro}</strong><div className="muted">{fecha(p.creado_en, true)}</div></td>
                      <td>{p.empresa_nombre}<div className="muted">{p.empresa_piso ? `Piso ${p.empresa_piso}` : ""}{p.empresa_local ? ` · local ${p.empresa_local}` : ""}</div></td>
                      <td>{p.cliente_nombre}<div className="muted">{p.cliente_email}{p.cliente_celular ? ` · ${p.cliente_celular}` : ""}</div></td>
                      <td style={{ maxWidth: 260 }}>{p.items.map((i) => `${i.cantidad}× ${i.producto_nombre}`).join(", ")}</td>
                      <td>{bs(p.total)}<div className="muted">{p.pagado_en ? `✓ pagado ${hora(p.pagado_en)}` : "sin pagar"}</div></td>
                      <td>{p.retiro_programado ? `⏰ ${fecha(p.retiro_programado, true)}` : "⚡ lo antes posible"}</td>
                      <td>
                        <span className={`pill ${CLASE[p.estado] || ""}`}>{p.estado_display}</span>
                        {p.reembolsado_en && <div className="muted">reembolsado</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No hay pedidos con ese filtro.</div>}
        </Estado>
      </div>
    </>
  );
}
