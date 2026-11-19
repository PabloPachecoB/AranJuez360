import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { bs, num } from '../../../admin/format'
import { StatTile } from '../../../admin/components/ui'
import { cargarParticipantes } from '../datos/proveedor'
import {
  actualizarParametroConsulta,
  filtrarCompras,
  filtrarParticipantesPorActividad,
  filtrarYOrdenarParticipantes,
  normalizarPagina,
  normalizarParametrosConsulta,
  TAMANO_PAGINA,
  type FiltrosActividad as ValoresActividad,
} from '../datos/consulta'
import { FiltrosActividad } from '../components/FiltrosActividad'
import { ListaParticipantes } from '../components/ListaParticipantes'
import type { OrdenParticipantes, ResultadoParticipantes } from '../datos/tipos'
import {
  campo,
  Encabezado,
  Icono,
  Mensaje,
  panel,
  principal,
} from '../components/elementosPresentacion'

type EstadoCarga = { estado: 'cargando' | 'error' } | ResultadoParticipantes

export default function ParticipantesPage() {
  const [params, setParams] = useSearchParams()
  const buscador = useRef<HTMLFormElement>(null)
  const [estado, setEstado] = useState<EstadoCarga>({ estado: 'cargando' })
  useEffect(() => {
    let activo = true
    cargarParticipantes()
      .then((resultado) => activo && setEstado(resultado))
      .catch(() => activo && setEstado({ estado: 'error' }))
    return () => {
      activo = false
    }
  }, [])

  const query = params.get('q') ?? ''
  const campaniaParam = params.get('campania') ?? ''
  const orden: OrdenParticipantes =
    params.get('orden') === 'monto' ? 'monto' : 'puntos'
  const datos = estado.estado === 'disponible' ? estado : null
  const campania = datos?.campanias.some((c) => c.id === campaniaParam)
    ? campaniaParam
    : ''
  const filtros = useMemo<ValoresActividad>(
    () => ({
      local: params.get('local') ?? '',
      desde: params.get('desde') ?? '',
      hasta: params.get('hasta') ?? '',
      participaciones: ['con', 'sin'].includes(
        params.get('participaciones') ?? '',
      )
        ? params.get('participaciones')!
        : '',
    }),
    [params],
  )
  const actividadFiltrada = Boolean(
    filtros.local || filtros.desde || filtros.hasta,
  )
  const filtrados = useMemo(
    () =>
      datos
        ? filtrarYOrdenarParticipantes(
            filtrarParticipantesPorActividad(
              datos.participantes,
              datos.compras,
              filtros,
            ),
            query,
            campania,
            orden,
          )
        : [],
    [datos, query, campania, orden, filtros],
  )
  const comprasSeleccion = datos
    ? filtrarCompras(
        datos.compras.filter((c) =>
          filtrados.some(
            (p) => p.id === c.participanteId && p.campaniaId === c.campaniaId,
          ),
        ),
        filtros,
      )
    : []
  const montoSeleccion = comprasSeleccion
    .filter((c) => c.estado === 'APROBADA')
    .reduce((suma, c) => suma + c.montoBs, 0)
  const paginas = Math.max(1, Math.ceil(filtrados.length / TAMANO_PAGINA))
  const pagina = normalizarPagina(params.get('pagina'), paginas).pagina
  const filas = filtrados.slice(
    (pagina - 1) * TAMANO_PAGINA,
    pagina * TAMANO_PAGINA,
  )

  useEffect(() => {
    if (!datos) return
    const siguientes = normalizarParametrosConsulta(
      params,
      new Set(datos.campanias.map((c) => c.id)),
      paginas,
    )
    if (siguientes.toString() !== params.toString())
      setParams(siguientes, { replace: true })
  }, [datos, params, paginas, setParams])

  function cambiar(clave: string, valor: string) {
    setParams((actuales) => actualizarParametroConsulta(actuales, clave, valor))
  }
  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    cambiar(
      'q',
      String(new FormData(event.currentTarget).get('buscar') ?? '').trim(),
    )
  }
  function limpiar() {
    buscador.current?.reset()
    setParams((actuales) => {
      const siguientes = new URLSearchParams(actuales)
      for (const clave of [
        'q',
        'campania',
        'orden',
        'pagina',
        'local',
        'desde',
        'hasta',
        'participaciones',
      ])
        siguientes.delete(clave)
      return siguientes
    })
  }
  function irPagina(nueva: number) {
    setParams((actuales) => {
      const siguientes = new URLSearchParams(actuales)
      if (nueva <= 1) siguientes.delete('pagina')
      else siguientes.set('pagina', String(nueva))
      return siguientes
    })
  }
  function ficha(id: string) {
    return `/fidelizacion/participantes/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`
  }
  function aplicarActividad(nuevos: ValoresActividad) {
    setParams((actuales) => {
      const siguientes = new URLSearchParams(actuales)
      for (const clave of [
        'local',
        'desde',
        'hasta',
        'participaciones',
      ] as const) {
        if (nuevos[clave]) siguientes.set(clave, nuevos[clave]!)
        else siguientes.delete(clave)
      }
      siguientes.delete('pagina')
      return siguientes
    })
  }
  const tieneFiltros = Boolean(
    query || campania || actividadFiltrada || filtros.participaciones,
  )

  return (
    <>
      <Encabezado
        titulo="Fidelización"
        descripcion="Participantes y compras del programa de fidelización."
      />
      {estado.estado === 'cargando' && (
        <Mensaje titulo="Cargando participantes…" />
      )}
      {estado.estado === 'error' && (
        <Mensaje error titulo="No se pudieron cargar los participantes">
          Recarga la página para volver a intentarlo.
        </Mensaje>
      )}
      {estado.estado === 'no_disponible' && (
        <Mensaje titulo="Consulta no disponible">
          No se puede consultar la información de participantes en este momento.
        </Mensaje>
      )}
      {datos && (
        <>
          <div
            className="mb-space-md grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-space-md"
            aria-label="Resumen de los participantes que coinciden con los filtros"
          >
            <StatTile
              label={
                tieneFiltros ? 'Participantes encontrados' : 'Participantes'
              }
              value={filtrados.length}
              formato={num}
            />
            <StatTile
              label="Puntos"
              value={filtrados.reduce((sum, p) => sum + p.puntos, 0)}
              formato={num}
            />
            <StatTile
              label="Participaciones"
              value={filtrados.reduce((sum, p) => sum + p.participaciones, 0)}
              formato={num}
            />
            <StatTile
              label={
                actividadFiltrada ? 'Monto aprobado filtrado' : 'Monto aprobado'
              }
              value={
                actividadFiltrada
                  ? montoSeleccion
                  : filtrados.reduce((sum, p) => sum + p.montoAprobadoBs, 0)
              }
              formato={bs}
            />
          </div>
          {actividadFiltrada && (
            <p className="mb-space-md text-body-sm text-on-surface-variant">
              {comprasSeleccion.length} compras en el local y periodo
              seleccionados. El monto incluye solo compras aprobadas. Los saldos
              de los participantes corresponden a toda la campaña.
            </p>
          )}
          <section
            className={`${panel} overflow-hidden`}
            aria-label="Filtros de participantes"
          >
            <div className="border-b border-outline-variant/40 p-space-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Ranking de participantes
                  </h2>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                    Ordenado por{' '}
                    {orden === 'puntos'
                      ? 'puntos acumulados'
                      : 'monto aprobado'}{' '}
                    · {num(filtrados.length)} participantes
                  </p>
                </div>
                {tieneFiltros && (
                  <button
                    type="button"
                    className="min-h-10 rounded px-2 text-body-sm text-primary hover:underline"
                    onClick={limpiar}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="mt-space-sm flex flex-col gap-space-sm xl:flex-row xl:items-end">
                <form
                  ref={buscador}
                  key={query}
                  onSubmit={buscar}
                  role="search"
                  className="flex min-w-0 flex-1 flex-col gap-1.5"
                >
                  <label
                    htmlFor="buscar-participante"
                    className="font-label-md text-label-md text-on-surface-variant"
                  >
                    Buscar participante
                  </label>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant">
                        <Icono nombre="search" />
                      </span>
                      <input
                        id="buscar-participante"
                        name="buscar"
                        type="search"
                        defaultValue={query}
                        placeholder="Nombre, correo, celular o código"
                        className={`${campo} w-full pl-10`}
                      />
                    </div>
                    <button className={principal} type="submit">
                      Buscar
                    </button>
                  </div>
                </form>
                <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 xl:w-md">
                  <label className="flex min-w-0 flex-col gap-1.5 font-label-md text-label-md text-on-surface-variant">
                    Campaña
                    <select
                      aria-label="Campaña"
                      className={`${campo} w-full`}
                      value={campania}
                      onChange={(e) => cambiar('campania', e.target.value)}
                    >
                      <option value="">Todas las campañas</option>
                      {datos.campanias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 font-label-md text-label-md text-on-surface-variant">
                    Ordenar por
                    <select
                      aria-label="Ordenar participantes"
                      className={`${campo} w-full`}
                      value={orden}
                      onChange={(e) => cambiar('orden', e.target.value)}
                    >
                      <option value="puntos">Más puntos</option>
                      <option value="monto">Mayor monto aprobado</option>
                    </select>
                  </label>
                </div>
              </div>
              <FiltrosActividad
                key={JSON.stringify(filtros)}
                valores={filtros}
                locales={[
                  ...new Set(
                    datos.compras
                      .filter((c) => !campania || c.campaniaId === campania)
                      .map((c) => c.localNombre),
                  ),
                ].sort()}
                aplicar={aplicarActividad}
                limpiar={limpiar}
              />
              {query && (
                <p
                  className="mt-space-sm text-body-sm text-on-surface-variant"
                  aria-live="polite"
                >
                  Resultados para{' '}
                  <strong className="font-semibold text-on-surface">
                    “{query}”
                  </strong>
                </p>
              )}
            </div>
          </section>
          <ListaParticipantes
            participantes={filas}
            pagina={pagina}
            paginas={paginas}
            orden={orden}
            cambiarPagina={irPagina}
            limpiarFiltros={limpiar}
            urlFicha={ficha}
          />
        </>
      )}
    </>
  )
}
