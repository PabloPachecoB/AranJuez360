import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { bs, num } from '../../../admin/format'
import { StatTile } from '../../../admin/components/ui'
import { cargarFichaParticipante } from '../datos/proveedor'
import {
  actualizarPaginaHistorial,
  filtrarCompras,
  normalizarPagina,
  parametrosDeRegresoLista,
  TAMANO_HISTORIAL,
  type FiltrosActividad as ValoresActividad,
} from '../datos/consulta'
import { HistorialCompras } from '../components/HistorialCompras'
import type { ResultadoFichaParticipante } from '../datos/tipos'
import {
  Encabezado,
  Mensaje,
  panel,
} from '../components/elementosPresentacion'

type EstadoCarga = { estado: 'cargando' | 'error' } | ResultadoFichaParticipante

export default function ParticipanteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [resultado, setResultado] = useState<{
    id: string
    estado: EstadoCarga
  } | null>(null)
  useEffect(() => {
    let activo = true
    if (!id) return
    cargarFichaParticipante(id)
      .then((estado) => activo && setResultado({ id, estado }))
      .catch(() => activo && setResultado({ id, estado: { estado: 'error' } }))
    return () => {
      activo = false
    }
  }, [id])
  const estado: EstadoCarga = !id
    ? { estado: 'no_encontrado' }
    : resultado?.id === id
      ? resultado.estado
      : { estado: 'cargando' }
  const datos = estado.estado === 'disponible' ? estado : null
  const todasLasCompras = datos?.compras ?? []
  const valorHistorial = (clave: string, heredada: string) =>
    params.has(clave) ? (params.get(clave) ?? '') : (params.get(heredada) ?? '')
  const filtros: ValoresActividad = {
    local: valorHistorial('historialLocal', 'local'),
    desde: valorHistorial('historialDesde', 'desde'),
    hasta: valorHistorial('historialHasta', 'hasta'),
    estado: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'DEVUELTA'].includes(
      params.get('historialEstado') ?? '',
    )
      ? params.get('historialEstado')!
      : '',
  }
  const compras = filtrarCompras(todasLasCompras, filtros)
  const paginas = Math.max(1, Math.ceil(compras.length / TAMANO_HISTORIAL))
  const paginaParam = params.get('historialPagina')
  const normalizada = normalizarPagina(paginaParam, paginas)
  const pagina = normalizada.pagina
  useEffect(() => {
    if (datos && normalizada.necesitaNormalizar)
      setParams(actualizarPaginaHistorial(params, pagina), { replace: true })
  }, [datos, normalizada.necesitaNormalizar, pagina, params, setParams])
  const listaParams = parametrosDeRegresoLista(params).toString()
  const regreso = {
    to: `/fidelizacion${listaParams ? `?${listaParams}` : ''}`,
    texto: 'Volver a participantes',
  }
  const filas = compras.slice(
    (pagina - 1) * TAMANO_HISTORIAL,
    pagina * TAMANO_HISTORIAL,
  )
  const verComprobante = (compraId: string) =>
    `/fidelizacion/participantes/${encodeURIComponent(id ?? '')}/compras/${encodeURIComponent(compraId)}${params.size ? `?${params}` : ''}`
  function aplicarFiltros(nuevos: ValoresActividad) {
    setParams((actuales) => {
      const siguientes = new URLSearchParams(actuales)
      // Un valor vacío explícito permite limpiar el historial sin cambiar la lista original.
      siguientes.set('historialLocal', nuevos.local)
      siguientes.set('historialDesde', nuevos.desde)
      siguientes.set('historialHasta', nuevos.hasta)
      siguientes.set('historialEstado', nuevos.estado ?? '')
      siguientes.delete('historialPagina')
      return siguientes
    })
  }
  const limpiarHistorial = () =>
    aplicarFiltros({ local: '', desde: '', hasta: '', estado: '' })

  return (
    <>
      <Encabezado
        titulo={datos?.participante.nombre ?? 'Ficha del participante'}
        descripcion={
          datos
            ? `${datos.participante.codigo} · ${datos.campania.nombre}`
            : 'Datos del participante e historial de compras.'
        }
        regreso={regreso}
      />
      {estado.estado === 'cargando' && (
        <Mensaje titulo="Cargando participante…" />
      )}
      {estado.estado === 'error' && (
        <Mensaje error titulo="No se pudo cargar la ficha">
          Recarga la página para volver a intentarlo.
        </Mensaje>
      )}
      {estado.estado === 'no_encontrado' && (
        <Mensaje titulo="Participante no encontrado">
          Verifica el enlace o regresa a la lista de participantes.
        </Mensaje>
      )}
      {estado.estado === 'no_disponible' && (
        <Mensaje titulo="Consulta no disponible">
          No se puede consultar la información de participantes en este momento.
        </Mensaje>
      )}
      {datos && (
        <>
          <div className="mb-space-md grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-space-md">
            <StatTile
              label="Puntos"
              value={datos.participante.puntos}
              formato={num}
            />
            <StatTile
              label="Participaciones"
              value={datos.participante.participaciones}
              formato={num}
            />
            <StatTile
              label="Monto aprobado"
              value={datos.participante.montoAprobadoBs}
              formato={bs}
            />
            <StatTile
              label="Sobrante"
              value={datos.participante.sobranteBs}
              formato={bs}
            />
          </div>
          <section
            className={`${panel} mb-space-md p-space-md`}
            aria-label="Datos del participante"
          >
            <h2 className="mb-space-sm font-headline-sm text-headline-sm text-on-surface">
              Información de contacto
            </h2>
            <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['Correo', datos.participante.correo],
                ['Celular', datos.participante.celular],
                ['Campaña', datos.campania.nombre],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0">
                  <dt className="font-label-md text-label-md text-on-surface-variant">
                    {etiqueta}
                  </dt>
                  <dd className="mt-1 wrap-break-words font-body-sm text-body-sm text-on-surface">
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <HistorialCompras
            participante={datos.participante.nombre}
            todasLasCompras={todasLasCompras}
            compras={compras}
            filas={filas}
            filtros={filtros}
            pagina={pagina}
            paginas={paginas}
            aplicarFiltros={aplicarFiltros}
            limpiarFiltros={limpiarHistorial}
            urlComprobante={verComprobante}
            cambiarPagina={(n) => setParams(actualizarPaginaHistorial(params, n))}
          />        </>
      )}
    </>
  )
}
