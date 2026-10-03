import { Link, useParams } from "react-router-dom";
import { Estado, StatTile, useApi } from "../components/ui";
import { bs, fecha, hace, num, TIPOS } from "../format";

const TIPO_MOV: Record<string, string> = { VISITA: "Visita", COMPRA: "Compra", CANJE: "Canje" };

interface HistorialCliente {
  cliente: {
    nombre: string;
    email: string;
    celular: string | null;
    registrado_en: string;
    activo: boolean;
    puntos_saldo: number;
  };
  totales: {
    visitas: number;
    tickets: number;
    monto_total: number;
    tiendas_distintas: number;
    ultima_visita: string | null;
  };
  tiendas: Array<{
    empresa: number;
    nombre: string;
    tipo: string;
    tickets: number;
    monto: number;
    puntos: number;
    ultimo_ticket: string | null;
  }>;
  ultimos_movimientos: Array<{
    creado_en: string;
    tipo: string;
    empresa__nombre: string | null;
    descripcion: string;
    puntos: number;
  }>;
}

const tarjeta = "min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md";
const subtitulo = "mb-space-sm text-body-sm text-on-surface-variant";
const tabla = "w-full border-collapse text-left font-body-sm text-body-sm text-on-surface";
const th = "whitespace-nowrap border-b border-outline-variant/40 px-space-sm py-space-sm font-label-md text-label-md text-on-surface-variant";
const td = "border-b border-outline-variant/30 px-space-sm py-space-sm align-middle";
const etiqueta = "inline-flex rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant";

export default function ClienteHistorial() {
  const { id } = useParams();
  const { data, error, cargando } = useApi<HistorialCliente>(`/admin/reportes/clientes/${id}/historial/`);
  const max = Math.max(1, ...(data?.tiendas || []).map((tienda) => tienda.tickets));

  return (
    <>
      <p className="mb-space-md">
        <Link className="font-label-md text-label-md text-primary hover:underline" to="/usuarios?rol=CLIENTE">← Clientes</Link>
      </p>
      <Estado cargando={cargando} error={error}>
        {data && (
          <>
            <header className="mb-space-md">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{data.cliente.nombre}</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {data.cliente.email} · {data.cliente.celular || "sin celular"} · cliente desde {fecha(data.cliente.registrado_en)}
                {!data.cliente.activo && " · cuenta inactiva"}
              </p>
            </header>

            <div className="mb-space-md grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-space-md">
              <StatTile label="Puntos actuales" value={data.cliente.puntos_saldo} />
              <StatTile label="Visitas" value={data.totales.visitas} />
              <StatTile label="Tickets de fidelización" value={data.totales.tickets} />
              <StatTile label="Monto registrado" value={data.totales.monto_total} formato={bs} />
              <StatTile label="Tiendas distintas" value={data.totales.tiendas_distintas} />
              <div className={tarjeta}>
                <div className="font-label-md text-label-md text-on-surface-variant">Última visita</div>
                <div className="my-1 font-headline-lg text-headline-lg text-on-surface">{hace(data.totales.ultima_visita)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
              <section className={tarjeta}>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Tiendas donde más compra</h2>
                <p className={subtitulo}>Ordenadas por tickets aprobados (los rechazados no cuentan)</p>
                {data.tiendas.length === 0 ? (
                  <div className="py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">Todavía no registra compras.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tabla}>
                      <thead><tr>
                        <th className={th}>Tienda</th><th className={`${th} text-right`}>Tickets</th>
                        <th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Puntos</th><th className={th}>Último</th>
                      </tr></thead>
                      <tbody>{data.tiendas.map((tienda) => (
                        <tr key={tienda.empresa}>
                          <td className={td}>{tienda.nombre} <span className={etiqueta}>{TIPOS[tienda.tipo] || tienda.tipo}</span></td>
                          <td className={`${td} text-right tabular-nums`}>
                            <div className="flex items-center justify-end gap-space-sm">
                              <div className="h-2 rounded-r bg-secondary" style={{ width: `${(tienda.tickets / max) * 80}px` }} />
                              {num(tienda.tickets)}
                            </div>
                          </td>
                          <td className={`${td} text-right tabular-nums`}>{bs(tienda.monto)}</td>
                          <td className={`${td} text-right tabular-nums`}>{num(tienda.puntos)}</td>
                          <td className={td}>{hace(tienda.ultimo_ticket)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className={tarjeta}>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Últimos movimientos</h2>
                <p className={subtitulo}>Visitas, compras y canjes de puntos</p>
                {data.ultimos_movimientos.length === 0 ? (
                  <div className="py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">Sin movimientos.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tabla}>
                      <thead><tr>
                        <th className={th}>Fecha</th><th className={th}>Tipo</th><th className={th}>Detalle</th><th className={`${th} text-right`}>Puntos</th>
                      </tr></thead>
                      <tbody>{data.ultimos_movimientos.map((movimiento, indice) => (
                        <tr key={`${movimiento.creado_en}-${indice}`}>
                          <td className={td}>{fecha(movimiento.creado_en, true)}</td>
                          <td className={td}><span className={etiqueta}>{TIPO_MOV[movimiento.tipo] || movimiento.tipo}</span></td>
                          <td className={td}>{movimiento.empresa__nombre || movimiento.descripcion}</td>
                          <td className={`${td} text-right tabular-nums`}>
                            {movimiento.puntos > 0 ? `+${num(movimiento.puntos)}` : num(movimiento.puntos)}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </Estado>
    </>
  );
}
