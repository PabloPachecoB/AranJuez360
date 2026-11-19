import { useEffect, useState } from "react";
import { api } from "./api";
import { corto } from "./format";

/** Carga `path` y recarga cuando cambia. Devuelve { data, error, cargando, recargar }. */
export function useApi(path) {
  const [estado, setEstado] = useState({ data: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    api(path)
      .then((data) => vivo && setEstado({ data, error: null, cargando: false }))
      .catch((error) => vivo && setEstado({ data: null, error, cargando: false }));
    return () => { vivo = false; };
  }, [path, version]);

  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}

/** Indicador con variación contra el periodo anterior. */
export function StatTile({ label, value, anterior, formato = corto, mejorSiSube = true }) {
  let delta = null;
  if (anterior !== undefined && anterior !== null) {
    const a = Number(anterior);
    const v = Number(value);
    if (a === 0) delta = { texto: v > 0 ? "nuevo en el periodo" : "sin cambios", clase: "" };
    else {
      const pct = Math.round(((v - a) / a) * 100);
      const sube = pct > 0;
      const bueno = pct === 0 ? null : sube === mejorSiSube;
      delta = {
        texto: `${sube ? "▲" : pct < 0 ? "▼" : "■"} ${Math.abs(pct)}% vs. periodo anterior`,
        clase: bueno === null ? "" : bueno ? "up" : "down",
      };
    }
  }
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">{formato(value)}</div>
      {delta && <div className={`delta ${delta.clase}`}>{delta.texto}</div>}
    </div>
  );
}

export function Estado({ cargando, error, vacio, children }) {
  if (cargando) return <div className="empty">Cargando…</div>;
  if (error) return <div className="empty error">{error.message}</div>;
  if (vacio) return <div className="empty">Sin datos en este periodo.</div>;
  return children;
}
