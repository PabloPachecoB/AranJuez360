import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SIMULADO } from "../api";

/** Marco común de las páginas públicas de la tarjeta: pensado primero para celular (se abre desde un QR). */
export function Marco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  // La pestaña del navegador no debe decir «Panel» en una página pública.
  useEffect(() => {
    const anterior = document.title;
    document.title = "Sorteo Paseo · Paseo Aranjuez 360";
    return () => {
      document.title = anterior;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-body-md text-body-md text-on-surface antialiased">
      {SIMULADO && (
        <p className="bg-tertiary-fixed px-4 py-2 text-center font-label-md text-label-md text-on-tertiary-fixed">
          Simulación: datos de ejemplo, no se conecta con el servidor
        </p>
      )}
      <header className="bg-primary shadow-md">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
          <Link to="/tarjeta" aria-label="Paseo Aranjuez 360: ir a mi tarjeta" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary-fixed-dim">
            {/* El PNG trae margen alrededor y el mismo fondo del encabezado (#00324b): object-cover recorta el margen. */}
            <img
              src="/logo-360-ancho-wallet.png"
              alt="Paseo Aranjuez 360"
              width={125}
              height={56}
              className="h-14 w-[125px] object-cover"
            />
          </Link>
          <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-tertiary-fixed-dim/60 px-3 py-1 font-label-md text-label-md font-semibold uppercase tracking-wide text-tertiary-fixed-dim">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              redeem
            </span>
            Sorteo Paseo
          </p>
        </div>
        {/* Línea dorada de la marca, como en la tarjeta de Wallet */}
        <div className="h-1 bg-gradient-to-r from-tertiary-fixed-dim via-[#daa520] to-tertiary-fixed-dim" aria-hidden="true" />
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-6">
        {/* overflow-wrap: un nombre largo sin espacios se parte en vez de ensanchar la página */}
        <h1 className="font-headline-lg text-headline-lg text-on-surface [overflow-wrap:anywhere]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-on-surface-variant [overflow-wrap:anywhere]">{subtitulo}</p>}
        <div className="mt-5">{children}</div>
      </main>
    </div>
  );
}

export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-error-container px-3 py-2 font-body-md text-body-md text-on-error-container">
      {children}
    </p>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-secondary-container px-3 py-2 font-body-md text-body-md text-on-secondary-container">
      {children}
    </p>
  );
}

/** Texto de ayuda bajo un campo: qué escribir y para qué sirve. Se enlaza al campo con aria-describedby. */
export function Ayuda({ id, children }: { id: string; children: ReactNode }) {
  return (
    <small id={id} className="font-body-sm text-body-sm font-normal text-on-surface-variant">
      {children}
    </small>
  );
}

export const inputClase =
  "h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
export const labelClase = "flex flex-col gap-1.5 font-label-md text-label-md font-semibold text-on-surface";
export const botonClase =
  "h-12 w-full rounded-lg bg-primary px-4 font-label-md text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60";
