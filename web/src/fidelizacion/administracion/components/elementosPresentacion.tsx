import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { EstadoCompraFidelizacion } from '../datos/tipos'
import { textoEstadoCompra } from '../datos/etiquetasCompra'

export const panel =
  'min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest'
export const campo =
  'min-h-11 min-w-0 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-space-sm py-2 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary'
const botonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-space-md py-2 font-label-sm text-label-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40'
export const boton = `${botonBase} border-outline-variant/60 text-primary hover:bg-surface-container-low`
export const principal = `${botonBase} border-primary bg-primary text-on-primary hover:bg-primary/90`
export const th =
  'whitespace-nowrap border-b border-outline-variant/40 px-space-md py-space-sm font-label-md text-label-md text-on-surface-variant'
export const td =
  'border-b border-outline-variant/30 px-space-md py-space-md align-middle'

export function Icono({ nombre }: { nombre: string }) {
  return (
    <span
      aria-hidden="true"
      className="material-symbols-outlined shrink-0 text-[20px] leading-none"
    >
      {nombre}
    </span>
  )
}

export function Encabezado({
  titulo,
  descripcion,
  regreso,
}: {
  titulo: string
  descripcion: string
  regreso?: { to: string; texto: string }
}) {
  return (
    <header className="mb-4.5">
      {regreso && (
        <Link
          to={regreso.to}
          className="group mb-space-sm inline-flex min-h-10 items-center gap-2 rounded-lg pr-3 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-surface-container-low transition-colors group-hover:bg-surface-container">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5m0 0 7 7m-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {regreso.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="wrap-break-words font-headline-lg text-headline-lg leading-[32px] tracking-[-0.02em] text-on-surface">
            {titulo}
          </h1>
          <p className="mt-0.5 max-w-[65ch] font-body-md text-body-md text-outline">
            {descripcion}
          </p>
        </div>
        <span
          role="note"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface-variant"
          title="Datos y comprobantes ficticios para revisar el módulo"
        >
          <Icono nombre="science" />
          Datos de ejemplo
        </span>
      </div>
    </header>
  )
}

export function Mensaje({
  titulo,
  children,
  error = false,
  accion,
}: {
  titulo: string
  children?: ReactNode
  error?: boolean
  accion?: ReactNode
}) {
  return (
    <section
      className={`${panel} px-space-md py-space-xl text-center`}
      role={error ? 'alert' : 'status'}
    >
      <span className="mb-space-sm inline-flex rounded-full bg-surface-container p-3 text-on-surface-variant">
        <Icono nombre={error ? 'error_outline' : 'search'} />
      </span>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">
        {titulo}
      </h2>
      {children && (
        <p className="mx-auto mt-2 max-w-lg font-body-sm text-body-sm text-on-surface-variant">
          {children}
        </p>
      )}
      {accion && (
        <div className="mt-space-md flex justify-center">{accion}</div>
      )}
    </section>
  )
}

export function Paginacion({
  pagina,
  paginas,
  total,
  tamano,
  cambiar,
  etiqueta = 'resultados',
}: {
  pagina: number
  paginas: number
  total: number
  tamano: number
  cambiar: (pagina: number) => void
  etiqueta?: string
}) {
  return (
    <nav
      aria-label={`Paginación de ${etiqueta}`}
      className="flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/40 px-space-md py-space-sm"
    >
      <p aria-live="polite" className="text-body-sm text-on-surface-variant">
        {total
          ? `${(pagina - 1) * tamano + 1}–${Math.min(pagina * tamano, total)} de ${total}`
          : '0 resultados'}
      </p>
      <div className="flex items-center gap-space-sm">
        <button
          type="button"
          aria-label={`Página anterior de ${etiqueta}`}
          className={boton}
          disabled={pagina <= 1}
          onClick={() => cambiar(pagina - 1)}
        >
          <Icono nombre="chevron_left" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="whitespace-nowrap text-body-sm text-on-surface-variant">
          Página {pagina} de {paginas}
        </span>
        <button
          type="button"
          aria-label={`Página siguiente de ${etiqueta}`}
          className={boton}
          disabled={pagina >= paginas}
          onClick={() => cambiar(pagina + 1)}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <Icono nombre="chevron_right" />
        </button>
      </div>
    </nav>
  )
}

export function EstadoCompra({ estado }: { estado: EstadoCompraFidelizacion }) {
  const estilos = {
    APROBADA: 'bg-secondary-container text-on-secondary-container',
    PENDIENTE: 'bg-tertiary-fixed text-on-tertiary-fixed',
    RECHAZADA: 'bg-error-container text-on-error-container',
    DEVUELTA: 'bg-surface-container text-on-surface-variant',
  }
  return (
    <span
      aria-label={`Estado de compra: ${textoEstadoCompra(estado)}`}
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-label-sm text-label-sm font-semibold ${estilos[estado]}`}
    >
      {textoEstadoCompra(estado)}
    </span>
  )
}
