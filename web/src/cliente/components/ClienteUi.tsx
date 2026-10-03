import type { ReactNode } from "react";

export function CabeceraCliente({
  eyebrow,
  titulo,
  descripcion,
  action,
}: {
  eyebrow?: string;
  titulo: string;
  descripcion?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="font-label-md text-label-md font-bold uppercase text-secondary">{eyebrow}</p>}
        <h1 className="mt-1 font-headline-lg text-headline-lg text-on-surface sm:text-[30px] sm:leading-9">{titulo}</h1>
        {descripcion && <p className="mt-2 max-w-2xl font-body-md text-body-md text-on-surface-variant">{descripcion}</p>}
      </div>
      {action}
    </header>
  );
}

export function EstadoDatos({
  cargando,
  error,
  vacio,
  onRetry,
  children,
}: {
  cargando: boolean;
  error: string | null;
  vacio?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (cargando) return <div className="py-12 text-center font-body-md text-body-md text-on-surface-variant">Cargando…</div>;
  if (error) {
    return (
      <div className="border-l-4 border-error bg-error-container/40 px-4 py-3 text-on-error-container">
        <p className="font-body-md text-body-md">{error}</p>
        {onRetry && <button className="mt-2 font-label-md text-label-md font-bold underline" onClick={onRetry}>Reintentar</button>}
      </div>
    );
  }
  if (vacio) return <p className="py-10 text-center font-body-md text-body-md text-on-surface-variant">Todavía no hay información para mostrar.</p>;
  return children;
}

export function Superficie({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 border border-outline-variant/50 bg-surface-container-lowest p-5 sm:p-6 ${className}`}>{children}</section>;
}

