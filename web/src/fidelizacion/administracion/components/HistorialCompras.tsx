import { Link } from 'react-router-dom'
import { bs, fecha } from '../../../admin/format'
import { TAMANO_HISTORIAL, type FiltrosActividad as ValoresActividad } from '../datos/consulta'
import type { CompraFidelizacion } from '../datos/tipos'
import { FiltrosActividad } from './FiltrosActividad'
import { boton, EstadoCompra, Icono, Mensaje, Paginacion, panel, td, th } from './elementosPresentacion'

interface HistorialComprasProps {
  participante: string
  todasLasCompras: CompraFidelizacion[]
  compras: CompraFidelizacion[]
  filas: CompraFidelizacion[]
  filtros: ValoresActividad
  pagina: number
  paginas: number
  aplicarFiltros: (filtros: ValoresActividad) => void
  limpiarFiltros: () => void
  urlComprobante: (id: string) => string
  cambiarPagina: (pagina: number) => void
}

/** Historial filtrable de compras con tabla adaptada a móvil y escritorio. */
export function HistorialCompras({
  participante,
  todasLasCompras,
  compras,
  filas,
  filtros,
  pagina,
  paginas,
  aplicarFiltros,
  limpiarFiltros,
  urlComprobante,
  cambiarPagina,
}: HistorialComprasProps) {
  const montoAprobado = compras
    .filter((compra) => compra.estado === 'APROBADA')
    .reduce((total, compra) => total + compra.montoBs, 0)

  return (
    <section className={panel} aria-labelledby="historial-titulo">
      <div className="border-b border-outline-variant/40 p-space-md">
        <h2 id="historial-titulo" className="font-headline-sm text-headline-sm text-on-surface">
          Historial de compras
        </h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          {compras.length} de {todasLasCompras.length} compras · Monto aprobado:{' '}
          <strong className="font-semibold text-on-surface">{bs(montoAprobado)}</strong>
        </p>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Los saldos del participante corresponden a toda la campaña y no cambian al filtrar este historial.
        </p>
        <FiltrosActividad
          key={JSON.stringify(filtros)}
          valores={filtros}
          locales={[...new Set(todasLasCompras.map((compra) => compra.localNombre))].sort()}
          historial
          aplicar={aplicarFiltros}
          limpiar={limpiarFiltros}
        />
      </div>

      {compras.length === 0 ? (
        <div className="p-space-md">
          <Mensaje
            titulo={todasLasCompras.length ? 'Sin compras para estos filtros' : 'Sin compras registradas'}
            accion={todasLasCompras.length ? (
              <button type="button" className={boton} onClick={limpiarFiltros}>Limpiar filtros</button>
            ) : undefined}
          >
            {todasLasCompras.length
              ? 'Cambia el local, el periodo o el estado de compra.'
              : 'Este participante no tiene compras registradas en la campaña.'}
          </Mensaje>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full border-collapse text-left font-body-sm text-body-sm text-on-surface">
              <caption className="sr-only">Compras de {participante}</caption>
              <thead>
                <tr>
                  <th className={th}>Compra</th><th className={th}>Fecha</th>
                  <th className={`${th} text-right`}>Monto</th><th className={th}>Estado de compra</th>
                  <th className={th}>Aprobación</th><th className={th}><span className="sr-only">Comprobante</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((compra) => (
                  <tr key={compra.id} className="hover:bg-surface-container-low/60">
                    <td className={td}>
                      <div>{compra.localNombre}</div>
                      <div className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{compra.numeroComprobante}</div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{fecha(compra.fecha)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{bs(compra.montoBs)}</td>
                    <td className={td}><EstadoCompra estado={compra.estado} /></td>
                    <td className={td}>
                      <div>{compra.operador ?? '—'}</div>
                      <div className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                        {compra.fechaAprobacion ? fecha(compra.fechaAprobacion, true) : 'Sin aprobación'}
                      </div>
                    </td>
                    <td className={`${td} text-right`}>
                      <Link className={`${boton} whitespace-nowrap`} to={urlComprobante(compra.id)}>
                        <Icono nombre="receipt_long" />Ver comprobante
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-outline-variant/40 xl:hidden">
            {filas.map((compra) => (
              <article key={compra.id} className="p-space-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-on-surface">{compra.localNombre}</h3>
                    <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                      {compra.numeroComprobante} · {fecha(compra.fecha)}
                    </p>
                  </div>
                  <EstadoCompra estado={compra.estado} />
                </div>
                <div className="my-space-sm flex items-center justify-between gap-2">
                  <span className="text-body-sm text-on-surface-variant">{compra.operador ?? 'Sin operador'}</span>
                  <strong className="whitespace-nowrap text-body-md text-on-surface">{bs(compra.montoBs)}</strong>
                </div>
                {compra.fechaAprobacion && (
                  <p className="mb-space-sm text-label-sm text-on-surface-variant">
                    Fecha de aprobación: {fecha(compra.fechaAprobacion, true)}
                  </p>
                )}
                <Link className={`${boton} w-full`} to={urlComprobante(compra.id)}>
                  <Icono nombre="receipt_long" />Ver comprobante
                </Link>
              </article>
            ))}
          </div>
          <Paginacion
            pagina={pagina}
            paginas={paginas}
            total={compras.length}
            tamano={TAMANO_HISTORIAL}
            etiqueta="compras"
            cambiar={cambiarPagina}
          />
        </>
      )}
    </section>
  )
}
