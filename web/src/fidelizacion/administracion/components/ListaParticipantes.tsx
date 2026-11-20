import { Link } from 'react-router-dom'
import { bs, num } from '../../../admin/format'
import type { OrdenParticipantes, ParticipanteFidelizacion } from '../datos/tipos'
import { TAMANO_PAGINA } from '../datos/consulta'
import { boton, Icono, Mensaje, Paginacion, panel, td, th } from './elementosPresentacion'

interface ListaParticipantesProps {
  participantes: ParticipanteFidelizacion[]
  pagina: number
  paginas: number
  orden: OrdenParticipantes
  cambiarPagina: (pagina: number) => void
  limpiarFiltros: () => void
  urlFicha: (id: string) => string
}

/** Tabla de ranking en escritorio y tarjetas equivalentes en pantallas pequeñas. */
export function ListaParticipantes({
  participantes,
  pagina,
  paginas,
  orden,
  cambiarPagina,
  limpiarFiltros,
  urlFicha,
}: ListaParticipantesProps) {
  if (participantes.length === 0) {
    return (
      <div className={`${panel} p-space-md`}>
        <Mensaje
          titulo="Sin participantes para estos filtros"
          accion={
            <button type="button" className={boton} onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          }
        >
          Revisa la búsqueda o cambia los filtros.
        </Mensaje>
      </div>
    )
  }

  return (
    <section className={`${panel} overflow-hidden`} aria-label="Ranking de participantes">
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full border-collapse text-left font-body-sm text-body-sm text-on-surface">
          <caption className="sr-only">
            Ranking de participantes ordenado por {orden === 'puntos' ? 'puntos' : 'monto aprobado'}
          </caption>
          <thead>
            <tr>
              <th className={`${th} w-16 text-center`}>Puesto</th>
              <th className={th}>Participante</th>
              <th className={th}>Contacto</th>
              <th className={`${th} text-right`}>Puntos</th>
              <th className={`${th} text-right`}>Participaciones</th>
              <th className={`${th} text-right`}>Monto aprobado</th>
              <th className={`${th} text-right`}>Sobrante</th>
              <th className={th}><span className="sr-only">Ver ficha</span></th>
            </tr>
          </thead>
          <tbody>
            {participantes.map((participante, indice) => {
              const puesto = (pagina - 1) * TAMANO_PAGINA + indice + 1
              return (
                <tr key={participante.id} className="transition-colors hover:bg-surface-container-low/60">
                  <td className={`${td} text-center`}>
                    <PuestoRanking puesto={puesto} destacar={pagina === 1 && indice < 3} compacto />
                  </td>
                  <td className={td}>
                    <Link to={urlFicha(participante.id)} className="text-primary hover:underline">
                      {participante.nombre}
                    </Link>
                    <div className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{participante.codigo}</div>
                  </td>
                  <td className={`${td} break-all`}>
                    <div>{participante.correo}</div>
                    <div className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{participante.celular}</div>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{num(participante.puntos)}</td>
                  <td className={`${td} text-right tabular-nums`}>{num(participante.participaciones)}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{bs(participante.montoAprobadoBs)}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{bs(participante.sobranteBs)}</td>
                  <td className={td}>
                    <Link to={urlFicha(participante.id)} aria-label={`Ver ficha de ${participante.nombre}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-primary hover:bg-surface-container">
                      <Icono nombre="chevron_right" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-outline-variant/40 xl:hidden">
        {participantes.map((participante, indice) => {
          const puesto = (pagina - 1) * TAMANO_PAGINA + indice + 1
          return (
            <article key={participante.id} className="p-space-md">
              <Link to={urlFicha(participante.id)} className="flex items-center justify-between gap-3 text-primary">
                <span className="flex min-w-0 items-center gap-3">
                  <PuestoRanking puesto={puesto} destacar={pagina === 1 && indice < 3} />
                  <span className="min-w-0 font-semibold">
                    {participante.nombre}
                    <span className="mt-1 block font-normal text-label-sm text-on-surface-variant">{participante.codigo}</span>
                  </span>
                </span>
                <Icono nombre="chevron_right" />
              </Link>
              <div className="mt-3 break-all text-body-sm text-on-surface-variant">
                {participante.correo}<br />{participante.celular}
              </div>
              <dl className="mt-space-sm grid grid-cols-2 gap-3 text-body-sm">
                {[
                  ['Puntos', num(participante.puntos)],
                  ['Participaciones', num(participante.participaciones)],
                  ['Monto aprobado', bs(participante.montoAprobadoBs)],
                  ['Sobrante', bs(participante.sobranteBs)],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt className="text-label-sm text-on-surface-variant">{etiqueta}</dt>
                    <dd className="mt-1 font-semibold text-on-surface">{valor}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>

      <Paginacion pagina={pagina} paginas={paginas} total={participantes.length} tamano={TAMANO_PAGINA} cambiar={cambiarPagina} etiqueta="participantes" />
    </section>
  )
}

function PuestoRanking({ puesto, destacar, compacto = false }: { puesto: number; destacar: boolean; compacto?: boolean }) {
  const tamano = compacto ? 'size-8' : 'size-9'
  const resaltado = destacar ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-surface-container text-on-surface-variant'
  return <span className={`inline-flex ${tamano} shrink-0 items-center justify-center rounded-full font-label-md text-label-md tabular-nums ${resaltado}`}>{puesto}</span>
}
