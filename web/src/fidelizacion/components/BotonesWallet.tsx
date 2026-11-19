import { useRef, useState } from "react";
import { api, SIMULADO, SorteoApiError } from "../api";
import type { EstadoPase } from "../tipos";

interface Props {
  estadoGoogle: EstadoPase;
  /** Se llama tras publicar el pase para refrescar el estado de la tarjeta. */
  onPublicado?: () => void;
  /** Sin campaña activa no se puede emitir el pase: el texto explica por qué (vacío = se puede). */
  motivoDeshabilitado?: string;
}

export function BotonesWallet({ estadoGoogle, onPublicado, motivoDeshabilitado }: Props) {
  const deshabilitado = !!motivoDeshabilitado;
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false); // el estado no alcanza para frenar dos toques en el mismo instante

  async function guardarGoogle() {
    if (enCurso.current) return;
    enCurso.current = true;
    setError(null);
    setCargando(true);
    try {
      const { url } = await api.googleWallet();
      onPublicado?.();
      if (SIMULADO) return; // en simulación no hay a dónde ir
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof SorteoApiError ? err.message : "No pudimos preparar tu tarjeta. Prueba de nuevo.");
    } finally {
      enCurso.current = false;
      setCargando(false);
    }
  }

  const yaGuardada = estadoGoogle === "SINCRONIZADO";
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={guardarGoogle}
        disabled={cargando || deshabilitado}
        aria-describedby={deshabilitado ? "wallet-ayuda" : undefined}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-label-md text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          wallet
        </span>
        {cargando ? "Preparando…" : yaGuardada ? "Agregar otra vez a Google Wallet" : "Agregar a Google Wallet"}
      </button>
      <button
        type="button"
        disabled
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 font-label-md text-label-md font-semibold text-on-surface-variant opacity-70"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          phone_iphone
        </span>
        Apple Wallet · pronto
      </button>
      {deshabilitado && (
        <p id="wallet-ayuda" className="text-center text-on-surface-variant">
          {motivoDeshabilitado}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2 font-body-md text-body-md text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
