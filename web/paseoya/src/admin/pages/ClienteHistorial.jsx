import { Link, useParams } from "react-router-dom";
import { Estado, StatTile, useApi } from "../components/ui";
import { bs, fecha, hace, num, TIPOS } from "../format";

const TIPO_MOV = { VISITA: "Visita", COMPRA: "Compra", CANJE: "Canje" };

export default function ClienteHistorial() {
  const { id } = useParams();
  const { data, error, cargando } = useApi(`/admin/reportes/clientes/${id}/historial/`);
  const max = Math.max(1, ...(data?.tiendas || []).map((t) => t.tickets));

  return (
    <>
      <p><Link to="/usuarios?rol=CLIENTE">← Clientes</Link></p>
      <Estado cargando={cargando} error={error}>
        {data && (
          <>
            <div className="page-head">
              <div>
                <h1>{data.cliente.nombre}</h1>
                <p>
                  {data.cliente.email} · {data.cliente.celular || "sin celular"} · cliente desde {fecha(data.cliente.registrado_en)}
                  {!data.cliente.activo && " · cuenta inactiva"}
                </p>
              </div>
            </div>

            <div className="grid tiles">
              <StatTile label="Puntos actuales" value={data.cliente.puntos_saldo} />
              <StatTile label="Visitas" value={data.totales.visitas} />
              <StatTile label="Tickets de fidelización" value={data.totales.tickets} />
              <StatTile label="Monto registrado" value={data.totales.monto_total} formato={bs} />
              <StatTile label="Tiendas distintas" value={data.totales.tiendas_distintas} />
              <div className="card tile">
                <div className="label">Última visita</div>
                <div className="value">{hace(data.totales.ultima_visita)}</div>
              </div>
            </div>

            <div className="grid cols-2">
              <div className="card">
                <h2>Tiendas donde más compra</h2>
                <p className="sub">Ordenadas por tickets aprobados (los rechazados no cuentan)</p>
                {data.tiendas.length === 0 ? (
                  <div className="empty">Todavía no registra compras.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Tienda</th><th className="num">Tickets</th><th className="num">Monto</th><th className="num">Puntos</th><th>Último</th></tr>
                      </thead>
                      <tbody>
                        {data.tiendas.map((t) => (
                          <tr key={t.empresa}>
                            <td>{t.nombre} <span className="pill">{TIPOS[t.tipo]}</span></td>
                            <td className="num">
                              <div className="bar-cell">
                                <div className="bar" style={{ width: `${(t.tickets / max) * 80}px` }} />
                                {num(t.tickets)}
                              </div>
                            </td>
                            <td className="num">{bs(t.monto)}</td>
                            <td className="num">{num(t.puntos)}</td>
                            <td>{hace(t.ultimo_ticket)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h2>Últimos movimientos</h2>
                <p className="sub">Visitas, compras y canjes de puntos</p>
                {data.ultimos_movimientos.length === 0 ? (
                  <div className="empty">Sin movimientos.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th className="num">Puntos</th></tr></thead>
                      <tbody>
                        {data.ultimos_movimientos.map((m, i) => (
                          <tr key={i}>
                            <td>{fecha(m.creado_en, true)}</td>
                            <td><span className="pill">{TIPO_MOV[m.tipo]}</span></td>
                            <td>{m.empresa__nombre || m.descripcion}</td>
                            <td className="num">{m.puntos > 0 ? `+${num(m.puntos)}` : num(m.puntos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Estado>
    </>
  );
}
