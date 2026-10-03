import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { qs } from "../../api/client";
import { Barras, completarDias, SerieDiaria, type ChartRow } from "../components/charts";
import { Estado, StatTile, useApi } from "../components/ui";
import { bs, corto, hace, isoLocal, num, ROLES, TIPOS } from "../format";

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
];

interface ResumenPeriodo {
  visitas: number;
  clientes_distintos: number;
  clientes_nuevos: number;
  compras: number;
  monto_total: number;
  puntos_entregados: number;
}
interface ResumenApi {
  actual: ResumenPeriodo;
  anterior: ResumenPeriodo;
  puntos_en_circulacion: number;
  solicitudes_pendientes: number;
}
interface EmpresaRanking {
  id: number;
  nombre: string;
  tipo: string;
  compras: number;
  monto: number;
  clientes: number;
  tasa_rechazo: number;
}
interface ClienteRanking {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  total_visitas: number;
  total_compras: number;
  total_monto?: number;
  puntos_saldo: number;
  procedencia_nombre?: string;
  ultima_visita?: string | null;
}
interface ProcedenciaFila {
  procedencia: string;
  nombre: string;
  clientes: number;
  clientes_con_compras: number;
  compras: number;
  monto: number;
  visitas: number;
  monedas: number;
}
interface ProcedenciasApi {
  procedencias: ProcedenciaFila[];
  ciudades: { ciudad: string; clientes: number; monedas: number }[];
}

// Cómo ordenar "Mejores clientes".
const ORDENES = [
  { valor: "compras", label: "Compras" },
  { valor: "monto", label: "Monto" },
  { valor: "monedas", label: "Monedas" },
  { valor: "visitas", label: "Visitas" },
];
interface HoraPico { hora: number; visitas: number }
interface DiaSemana extends Record<string, string | number> { nombre: string; visitas: number }
interface RolResumen { rol: string; total: number; activos: number; sin_activar: number }

const tarjeta = "min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md";
const subtitulo = "mb-space-sm text-body-sm text-on-surface-variant";
const tabla = "w-full border-collapse text-left font-body-sm text-body-sm text-on-surface";
const th = "whitespace-nowrap border-b border-outline-variant/40 px-space-sm py-space-sm font-label-md text-label-md text-on-surface-variant";
const td = "border-b border-outline-variant/30 px-space-sm py-space-sm align-middle";
const etiqueta = "inline-flex rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant";
const tituloSeccion = "font-headline-sm text-headline-sm text-on-surface";

function rango(dias: number) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: isoLocal(desde), hasta: isoLocal(hasta) };
}

export default function Dashboard() {
  const [dias, setDias] = useState(30);
  // Filtro de procedencia para los volúmenes por día ("" = todos los clientes).
  const [procedencia, setProcedencia] = useState("");
  const [orden, setOrden] = useState("compras");
  const { desde, hasta } = useMemo(() => rango(dias), [dias]);
  const q = qs({ desde, hasta });
  const qProcedencia = qs({ desde, hasta, procedencia });

  const resumen = useApi<ResumenApi>(`/admin/reportes/resumen/${q}`);
  const visitas = useApi<ChartRow[]>(`/admin/reportes/visitas-por-dia/${qProcedencia}`);
  const compras = useApi<ChartRow[]>(`/admin/reportes/compras-por-dia/${qProcedencia}`);
  const procedencias = useApi<ProcedenciasApi>(`/admin/reportes/clientes/procedencia/${q}`);
  const horas = useApi<HoraPico[]>(`/admin/reportes/horas-pico/${q}`);
  const semana = useApi<DiaSemana[]>(`/admin/reportes/dias-semana/${q}`);
  const ranking = useApi<EmpresaRanking[]>(`/admin/reportes/empresas/ranking/${q}`);
  const frecuentes = useApi<ClienteRanking[]>(`/admin/reportes/clientes/frecuentes/${qs({ desde, hasta, limite: 10, orden, procedencia })}`);
  const dormidos = useApi<ClienteRanking[]>(`/admin/reportes/clientes/dormidos/${qs({ dias: 14 })}`);
  const roles = useApi<RolResumen[]>("/admin/reportes/usuarios-por-rol/");

  const serieVisitas = useMemo(
    () => completarDias(visitas.data, desde, hasta, ["visitas", "clientes"]),
    [visitas.data, desde, hasta],
  );
  const serieCompras = useMemo(
    () => completarDias(compras.data, desde, hasta, ["compras", "monto"]),
    [compras.data, desde, hasta],
  );
  const horasCompletas = useMemo(() => {
    const porHora = Object.fromEntries((horas.data || []).map((fila) => [fila.hora, fila.visitas]));
    return Array.from({ length: 13 }, (_, indice) => ({ hora: indice + 9, visitas: porHora[indice + 9] || 0 }));
  }, [horas.data]);

  const actual = resumen.data?.actual;
  const anterior = resumen.data?.anterior;
  const maxCompras = Math.max(1, ...(ranking.data || []).map((empresa) => empresa.compras));
  const filasProcedencia = procedencias.data?.procedencias || [];
  const maxMonto = Math.max(1, ...filasProcedencia.map((fila) => Number(fila.monto)));
  const nombreFiltro = filasProcedencia.find((fila) => fila.procedencia === procedencia)?.nombre;

  return (
    <>
      <header className="mb-space-md flex flex-wrap items-center justify-between gap-space-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Inicio</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Visitas registradas en portería y compras aprobadas en caja.</p>
        </div>
        <div className="inline-flex rounded-lg border border-outline-variant/40 bg-surface-container-low p-1" role="group" aria-label="Periodo">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.dias}
              type="button"
              aria-pressed={dias === periodo.dias}
              onClick={() => setDias(periodo.dias)}
              className={`rounded-md px-space-md py-space-sm font-label-md text-label-md transition-colors ${dias === periodo.dias ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {periodo.label}
            </button>
          ))}
        </div>
      </header>

      <Estado cargando={resumen.cargando && !actual} error={resumen.error}>
        {actual && anterior && (
          <div className="mb-space-md grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-space-md">
            <StatTile label="Visitas" value={actual.visitas} anterior={anterior.visitas} />
            <StatTile label="Clientes distintos" value={actual.clientes_distintos} anterior={anterior.clientes_distintos} />
            <StatTile label="Clientes nuevos" value={actual.clientes_nuevos} anterior={anterior.clientes_nuevos} />
            <StatTile label="Compras registradas" value={actual.compras} anterior={anterior.compras} />
            <StatTile label="Monto registrado" value={actual.monto_total} anterior={anterior.monto_total} formato={bs} />
            <StatTile label="Monedas entregadas" value={actual.puntos_entregados} anterior={anterior.puntos_entregados} />
            <StatTile label="Monedas en circulación" value={resumen.data?.puntos_en_circulacion} />
            <StatTile label="Solicitudes pendientes" value={resumen.data?.solicitudes_pendientes} />
          </div>
        )}
      </Estado>

      <section className={`${tarjeta} mb-space-md`}>
        <div className="flex flex-wrap items-start justify-between gap-space-sm">
          <div>
            <h2 className={tituloSeccion}>¿De dónde son los clientes?</h2>
            <p className={subtitulo}>Por provincia de Cochabamba u otro lugar · toca una fila para filtrar los gráficos y el ranking</p>
          </div>
          {procedencia && (
            <button type="button" onClick={() => setProcedencia("")} className={`${etiqueta} hover:text-primary`}>
              Filtro: {nombreFiltro} ✕
            </button>
          )}
        </div>
        <Estado cargando={procedencias.cargando && !procedencias.data} error={procedencias.error} vacio={!filasProcedencia.length}>
          <div className="overflow-x-auto">
            <table className={tabla}>
              <thead><tr>
                <th className={th}>Procedencia</th><th className={`${th} text-right`}>Clientes</th>
                <th className={`${th} text-right`}>Compras</th><th className={`${th} text-right`}>Monto</th>
                <th className={`${th} text-right`}>Visitas</th><th className={`${th} text-right`}>Monedas</th>
              </tr></thead>
              <tbody>{filasProcedencia.map((fila) => (
                <tr key={fila.procedencia} onClick={() => setProcedencia(procedencia === fila.procedencia ? "" : fila.procedencia)}
                  className={`cursor-pointer hover:bg-surface-container-low ${procedencia === fila.procedencia ? "bg-primary-fixed/40" : ""}`}>
                  <td className={td}>{fila.nombre}</td>
                  <td className={`${td} text-right tabular-nums`}>{num(fila.clientes)}</td>
                  <td className={`${td} text-right tabular-nums`}>{num(fila.compras)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    <div className="flex items-center justify-end gap-space-sm">
                      <div className="h-2 rounded-r bg-secondary" style={{ width: `${(Number(fila.monto) / maxMonto) * 90}px` }} />
                      {bs(fila.monto)}
                    </div>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{num(fila.visitas)}</td>
                  <td className={`${td} text-right tabular-nums`}>{corto(fila.monedas)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!!procedencias.data?.ciudades.length && (
            <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
              De fuera de Cochabamba: {procedencias.data.ciudades.map((c) => `${c.ciudad} (${c.clientes})`).join(" · ")}
            </p>
          )}
        </Estado>
      </section>

      <div className="mb-space-md grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Visitas por día{nombreFiltro ? ` · ${nombreFiltro}` : ""}</h2>
          <p className={subtitulo}>Ingresos registrados por los porteros</p>
          <Estado cargando={visitas.cargando} error={visitas.error}>
            <SerieDiaria data={serieVisitas} campo="visitas" nombre="Visitas" color="var(--color-primary)"
              extra={[{ campo: "clientes", nombre: "Clientes distintos", formato: num }]} />
          </Estado>
        </section>
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Compras por día{nombreFiltro ? ` · ${nombreFiltro}` : ""}</h2>
          <p className={subtitulo}>Tickets de fidelización aprobados en caja</p>
          <Estado cargando={compras.cargando} error={compras.error}>
            <SerieDiaria data={serieCompras} campo="compras" nombre="Compras" color="var(--color-secondary)"
              extra={[{ campo: "monto", nombre: "Monto", formato: bs }]} />
          </Estado>
        </section>
      </div>

      <div className="mb-space-md grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Horas pico</h2>
          <p className={subtitulo}>Visitas según la hora de ingreso</p>
          <Estado cargando={horas.cargando} error={horas.error}>
            <Barras data={horasCompletas} x="hora" y="visitas" nombre="Visitas" color="var(--color-primary)"
              formatoX={(hora) => `${hora}h`} />
          </Estado>
        </section>
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Días de la semana</h2>
          <p className={subtitulo}>Visitas acumuladas por día</p>
          <Estado cargando={semana.cargando} error={semana.error} vacio={!semana.data?.length}>
            <Barras data={semana.data || []} x="nombre" y="visitas" nombre="Visitas" color="var(--color-primary)"
              formatoX={(dia) => String(dia).slice(0, 3)} />
          </Estado>
        </section>
      </div>

      <div className="mb-space-md grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Empresas con más actividad</h2>
          <p className={subtitulo}>Compras aprobadas en el periodo · las oficinas no tienen caja</p>
          <Estado cargando={ranking.cargando} error={ranking.error} vacio={!ranking.data?.length}>
            <div className="overflow-x-auto">
              <table className={tabla}>
                <thead><tr>
                  <th className={th}>Empresa</th><th className={`${th} text-right`}>Compras</th>
                  <th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Clientes</th>
                  <th className={`${th} text-right`}>Rechazo</th>
                </tr></thead>
                <tbody>{(ranking.data || []).map((empresa) => (
                  <tr key={empresa.id}>
                    <td className={td}>{empresa.nombre} <span className={etiqueta}>{TIPOS[empresa.tipo] || empresa.tipo}</span></td>
                    <td className={`${td} text-right tabular-nums`}>
                      <div className="flex items-center justify-end gap-space-sm">
                        <div className="h-2 rounded-r bg-secondary" style={{ width: `${(empresa.compras / maxCompras) * 80}px` }} />
                        {num(empresa.compras)}
                      </div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{bs(empresa.monto)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(empresa.clientes)}</td>
                    <td className={`${td} text-right tabular-nums`}>{Math.round(empresa.tasa_rechazo * 100)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Estado>
        </section>

        <section className={tarjeta}>
          <div className="flex flex-wrap items-start justify-between gap-space-sm">
            <div>
              <h2 className={tituloSeccion}>Mejores clientes{nombreFiltro ? ` · ${nombreFiltro}` : ""}</h2>
              <p className={subtitulo}>En el periodo · clic para ver su historial</p>
            </div>
            <div className="inline-flex rounded-lg border border-outline-variant/40 bg-surface-container-low p-1" role="group" aria-label="Ordenar por">
              {ORDENES.map((o) => (
                <button key={o.valor} type="button" aria-pressed={orden === o.valor} onClick={() => setOrden(o.valor)}
                  className={`rounded-md px-space-sm py-1 font-label-sm text-label-sm ${orden === o.valor ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <Estado cargando={frecuentes.cargando} error={frecuentes.error} vacio={!frecuentes.data?.length}>
            <div className="overflow-x-auto">
              <table className={tabla}>
                <thead><tr>
                  <th className={th}>Cliente</th><th className={th}>Procedencia</th>
                  <th className={`${th} text-right`}>Compras</th><th className={`${th} text-right`}>Monto</th>
                  <th className={`${th} text-right`}>Visitas</th><th className={`${th} text-right`}>Monedas</th>
                </tr></thead>
                <tbody>{(frecuentes.data || []).map((cliente) => (
                  <tr key={cliente.id}>
                    <td className={td}><Link className="text-primary hover:underline" to={`/clientes/${cliente.id}`}>
                      {`${cliente.first_name} ${cliente.last_name}`.trim() || cliente.email}
                    </Link></td>
                    <td className={td}><span className={etiqueta}>{cliente.procedencia_nombre || "Sin indicar"}</span></td>
                    <td className={`${td} text-right tabular-nums`}>{num(cliente.total_compras)}</td>
                    <td className={`${td} text-right tabular-nums`}>{bs(cliente.total_monto)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(cliente.total_visitas)}</td>
                    <td className={`${td} text-right tabular-nums`}>{corto(cliente.puntos_saldo)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Estado>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Clientes que no vuelven</h2>
          <p className={subtitulo}>Sin visitas en los últimos 14 días: candidatos a una promoción</p>
          <Estado cargando={dormidos.cargando} error={dormidos.error} vacio={!dormidos.data?.length}>
            <div className="overflow-x-auto">
              <table className={tabla}>
                <thead><tr><th className={th}>Cliente</th><th className={th}>Última visita</th><th className={`${th} text-right`}>Puntos</th></tr></thead>
                <tbody>{(dormidos.data || []).slice(0, 8).map((cliente) => (
                  <tr key={cliente.id}>
                    <td className={td}><Link className="text-primary hover:underline" to={`/clientes/${cliente.id}`}>
                      {`${cliente.first_name} ${cliente.last_name}`.trim() || cliente.email}
                    </Link></td>
                    <td className={td}>{hace(cliente.ultima_visita)}</td>
                    <td className={`${td} text-right tabular-nums`}>{corto(cliente.puntos_saldo)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Estado>
        </section>

        <section className={tarjeta}>
          <h2 className={tituloSeccion}>Usuarios por rol</h2>
          <p className={subtitulo}>Cuentas activas y sin activar (nunca cambiaron la contraseña temporal)</p>
          <Estado cargando={roles.cargando} error={roles.error}>
            <div className="overflow-x-auto">
              <table className={tabla}>
                <thead><tr><th className={th}>Rol</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Activos</th><th className={`${th} text-right`}>Sin activar</th></tr></thead>
                <tbody>{(roles.data || []).map((rol) => (
                  <tr key={rol.rol}>
                    <td className={td}><Link className="text-primary hover:underline" to={`/usuarios?rol=${rol.rol}`}>
                      {ROLES[rol.rol] || rol.rol}
                    </Link></td>
                    <td className={`${td} text-right tabular-nums`}>{num(rol.total)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(rol.activos)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(rol.sin_activar)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Estado>
        </section>
      </div>
    </>
  );
}
