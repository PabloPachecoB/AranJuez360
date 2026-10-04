import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../api/client";
import { corto } from "../format";

interface ApiState<T> {
  data: T | null;
  error: Error | null;
  cargando: boolean;
}

/** Carga `path` y recarga cuando cambia. */
export function useApi<T = unknown>(path: string | null) {
  const [estado, setEstado] = useState<ApiState<T>>({ data: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let vivo = true;
    setEstado((actual) => ({ ...actual, cargando: true, error: null }));
    api<T>(path)
      .then((data) => vivo && setEstado({ data, error: null, cargando: false }))
      .catch((error: unknown) => {
        if (vivo) {
          setEstado({
            data: null,
            error: error instanceof Error ? error : new Error("Ocurrió un error inesperado."),
            cargando: false,
          });
        }
      });
    return () => { vivo = false; };
  }, [path, version]);

  return { ...estado, recargar: () => setVersion((actual) => actual + 1) };
}

interface StatTileProps {
  label: string;
  value: unknown;
  anterior?: unknown;
  formato?: (value: unknown) => string;
  mejorSiSube?: boolean;
}

export function StatTile({
  label,
  value,
  anterior,
  formato = corto,
  mejorSiSube = true,
}: StatTileProps) {
  let delta: { texto: string; clase: string } | null = null;

  if (anterior !== undefined && anterior !== null) {
    const a = Number(anterior);
    const v = Number(value);
    if (a === 0) {
      delta = { texto: v > 0 ? "nuevo en el periodo" : "sin cambios", clase: "" };
    } else {
      const pct = Math.round(((v - a) / a) * 100);
      const sube = pct > 0;
      const bueno = pct === 0 ? null : sube === mejorSiSube;
      delta = {
        texto: `${sube ? "▲" : pct < 0 ? "▼" : "■"} ${Math.abs(pct)}% vs. periodo anterior`,
        clase: bueno === null ? "text-on-surface-variant" : bueno ? "text-secondary" : "text-error",
      };
    }
  }

  return (
    <div className="min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md">
      <div className="font-label-md text-label-md text-on-surface-variant">{label}</div>
      <div className="my-1 font-headline-lg text-headline-lg text-on-surface">{formato(value)}</div>
      {delta && <div className={`font-body-sm text-body-sm ${delta.clase}`}>{delta.texto}</div>}
    </div>
  );
}

interface EstadoProps {
  cargando: boolean;
  error: Error | null;
  vacio?: boolean;
  children: ReactNode;
}

export function Estado({ cargando, error, vacio = false, children }: EstadoProps) {
  if (cargando) {
    return <div className="px-space-md py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">Cargando…</div>;
  }
  if (error) {
    return <div className="px-space-md py-space-lg text-center font-body-sm text-body-sm text-error">{error.message}</div>;
  }
  if (vacio) {
    return <div className="px-space-md py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">Sin datos en este periodo.</div>;
  }
  return children;
}
