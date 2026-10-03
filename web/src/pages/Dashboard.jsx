import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { qs } from "../api";
import { Barras, completarDias, SerieDiaria } from "../components/charts";
import { Estado, StatTile, useApi } from "../components/ui";
import { bs, corto, hace, isoLocal, num, ROLES, TIPOS } from "../format";

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
];

function rango(dias) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: isoLocal(desde), hasta: isoLocal(hasta) };
}

export default function Dashboard() {
  const [dias, setDias] = useState(30);
  const { desde, hasta } = useMemo(() => rango(dias), [dias]);
  const q = qs({ desde, hasta });

  const resumen = useApi(`/admin/reportes/resumen/${q}`);
  const visitas = useApi(`/admin/reportes/visitas-por-dia/${q}`);
  const compras = useApi(`/admin/reportes/compras-por-dia/${q}`);
  const horas = useApi(`/admin/reportes/horas-pico/${q}`);
  const semana = useApi(`/admin/reportes/dias-semana/${q}`);
  const ranking = useApi(`/admin/reportes/empresas/ranking/${q}`);
  const frecuentes = useApi(`/admin/reportes/clientes/frecuentes/${qs({ desde, hasta, limite: 8 })}`);
  const dormidos = useApi(`/admin/reportes/clientes/dormidos/${qs({ dias: 14 })}`);
  const roles = useApi("/admin/reportes/usuarios-por-rol/");

  const serieVisitas = useMemo(
    () => completarDias(visitas.data, desde, hasta, ["visitas", "clientes"]), [visitas.data, desde, hasta]);
  const serieCompras = useMemo(
    () => completarDias(compras.data, desde, hasta, ["compras", "monto"]), [compras.data, desde, hasta]);
  const horasCompletas = useMemo(() => {
    const m = Object.fromEntries((horas.data || []).map((h) => [h.hora, h.visitas]));
    return Array.from({ length: 13 }, (_, i) => ({ hora: i + 9, visitas: m[i + 9] || 0 }));
  }, [horas.data]);

  const a = resumen.data?.actual;
  const p = resumen.data?.anterior;
  const maxCompras = Math.max(1, ...(ranking.data || []).map((e) => e.compras));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inicio</h1>
          <p>Visitas registradas en portería y compras aprobadas en caja.</p>
        </div>
        <div className="segmented" role="group" aria-label="Periodo">
          {PERIODOS.map((o) => (
            <button key={o.dias} aria-pressed={dias === o.dias} onClick={() => setDias(o.dias)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Estado cargando={resumen.cargando && !a} error={resumen.error}>
        {a && (
          <div className="grid tiles">
            <StatTile label="Visitas" value={a.visitas} anterior={p.visitas} />
            <StatTile label="Clientes distintos" value={a.clientes_distintos} anterior={p.clientes_distintos} />
            <StatTile label="Clientes nuevos" value={a.clientes_nuevos} anterior={p.clientes_nuevos} />
            <StatTile label="Compras registradas" value={a.compras} anterior={p.compras} />
            <StatTile label="Monto registrado" value={a.monto_total} anterior={p.monto_total} formato={bs} />
            <StatTile label="Puntos entregados" value={a.puntos_entregados} anterior={p.puntos_entregados} />
            <StatTile label="Puntos en circulación" value={resumen.data.puntos_en_circulacion} />
            <StatTile label="Solicitudes pendientes" value={resumen.data.solicitudes_pendientes} />
          </div>
        )}
      </Estado>

      <div className="grid cols-2">
        <div className="card">
          <h2>Visitas por día</h2>
          <p className="sub">Ingresos registrados por los porteros</p>
          <Estado cargando={visitas.cargando} error={visitas.error}>
            <SerieDiaria data={serieVisitas} campo="visitas" nombre="Visitas" color="var(--series-1)"
              extra={[{ campo: "clientes", nombre: "Clientes distintos", formato: num }]} />
          </Estado>
        </div>
        <div className="card">
          <h2>Compras por día</h2>
          <p className="sub">Tickets de fidelización aprobados en caja</p>
          <Estado cargando={compras.cargando} error={compras.error}>
            <SerieDiaria data={serieCompras} campo="compras" nombre="Compras" color="var(--series-2)"
              extra={[{ campo: "monto", nombre: "Monto", formato: bs }]} />
          </Estado>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Horas pico</h2>
          <p className="sub">Visitas según la hora de ingreso</p>
          <Estado cargando={horas.cargando} error={horas.error}>
            <Barras data={horasCompletas} x="hora" y="visitas" nombre="Visitas" color="var(--series-1)"
              formatoX={(h) => `${h}h`} />
          </Estado>
        </div>
        <div className="card">
          <h2>Días de la semana</h2>
          <p className="sub">Visitas acumuladas por día</p>
          <Estado cargando={semana.cargando} error={semana.error} vacio={!semana.data?.length}>
            <Barras data={semana.data || []} x="nombre" y="visitas" nombre="Visitas" color="var(--series-1)"
              formatoX={(d) => String(d).slice(0, 3)} />
          </Estado>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Empresas con más actividad</h2>
          <p className="sub">Compras aprobadas en el periodo · las oficinas no tienen caja</p>
          <Estado cargando={ranking.cargando} error={ranking.error} vacio={!ranking.data?.length}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th className="num">Compras</th>
                    <th className="num">Monto</th>
                    <th className="num">Clientes</th>
                    <th className="num">Rechazo</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranking.data || []).map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.nombre} <span className="pill">{TIPOS[e.tipo]}</span>
                      </td>
                      <td className="num">
                        <div className="bar-cell">
                          <div className="bar" style={{ width: `${(e.compras / maxCompras) * 80}px` }} />
                          {num(e.compras)}
                        </div>
                      </td>
                      <td className="num">{bs(e.monto)}</td>
                      <td className="num">{num(e.clientes)}</td>
                      <td className="num">{Math.round(e.tasa_rechazo * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Estado>
        </div>

        <div className="card">
          <h2>Clientes frecuentes</h2>
          <p className="sub">Más visitas en el periodo · clic para ver su historial</p>
          <Estado cargando={frecuentes.cargando} error={frecuentes.error} vacio={!frecuentes.data?.length}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="num">Visitas</th>
                    <th className="num">Compras</th>
                    <th className="num">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {(frecuentes.data || []).map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/clientes/${c.id}`}>{`${c.first_name} ${c.last_name}`.trim() || c.email}</Link></td>
                      <td className="num">{num(c.total_visitas)}</td>
                      <td className="num">{num(c.total_compras)}</td>
                      <td className="num">{corto(c.puntos_saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Estado>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Clientes que no vuelven</h2>
          <p className="sub">Sin visitas en los últimos 14 días: candidatos a una promoción</p>
          <Estado cargando={dormidos.cargando} error={dormidos.error} vacio={!dormidos.data?.length}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Cliente</th><th>Última visita</th><th className="num">Puntos</th></tr>
                </thead>
                <tbody>
                  {(dormidos.data || []).slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/clientes/${c.id}`}>{`${c.first_name} ${c.last_name}`.trim() || c.email}</Link></td>
                      <td>{hace(c.ultima_visita)}</td>
                      <td className="num">{corto(c.puntos_saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Estado>
        </div>
        <div className="card">
          <h2>Usuarios por rol</h2>
          <p className="sub">Cuentas activas y sin activar (nunca cambiaron la contraseña temporal)</p>
          <Estado cargando={roles.cargando} error={roles.error}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Rol</th><th className="num">Total</th><th className="num">Activos</th><th className="num">Sin activar</th></tr>
                </thead>
                <tbody>
                  {(roles.data || []).map((r) => (
                    <tr key={r.rol}>
                      <td><Link to={`/usuarios?rol=${r.rol}`}>{ROLES[r.rol] || r.rol}</Link></td>
                      <td className="num">{num(r.total)}</td>
                      <td className="num">{num(r.activos)}</td>
                      <td className="num">{num(r.sin_activar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Estado>
        </div>
      </div>
    </>
  );
}
