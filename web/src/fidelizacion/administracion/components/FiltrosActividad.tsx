import { useState, type FormEvent } from "react";
import { validarPeriodo, type FiltrosActividad as Valores } from "../datos/consulta";
import { boton, campo, Icono } from "./elementosPresentacion";
import { textoEstadoCompra } from "../datos/etiquetasCompra";

export function FiltrosActividad({ valores, locales, historial = false, aplicar, limpiar }: {
  valores: Valores;
  locales: string[];
  historial?: boolean;
  aplicar: (valores: Valores) => void;
  limpiar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const nuevos: Valores = { local: String(datos.get("local") ?? ""), desde: String(datos.get("desde") ?? ""), hasta: String(datos.get("hasta") ?? ""), participaciones: String(datos.get("participaciones") ?? ""), estado: String(datos.get("estado") ?? "") };
    const problema = validarPeriodo(nuevos.desde, nuevos.hasta);
    setError(problema);
    if (!problema) aplicar(nuevos);
  }
  const problema = error ?? validarPeriodo(valores.desde, valores.hasta);
  const etiqueta = "flex min-w-0 flex-col gap-1.5 font-label-md text-label-md text-on-surface-variant";
  const activos: { clave: keyof Valores; texto: string; valor: string | undefined }[] = [
    { clave: "local", texto: "Local", valor: valores.local },
    { clave: "desde", texto: "Desde", valor: valores.desde },
    { clave: "hasta", texto: "Hasta", valor: valores.hasta },
    ...(historial ? [{ clave: "estado" as const, texto: "Estado de compra", valor: valores.estado ? textoEstadoCompra(valores.estado) : "" }]
      : [{ clave: "participaciones" as const, texto: "Participaciones", valor: valores.participaciones === "con" ? "Con participaciones" : valores.participaciones === "sin" ? "Sin participaciones" : "" }]),
  ];
  return <form onSubmit={enviar} aria-label={historial ? "Filtrar historial de compras" : "Filtrar actividad de participantes"} className="mt-space-md border-t border-outline-variant/30 pt-space-md">
    <div className="grid grid-cols-1 items-end gap-space-sm sm:grid-cols-2 xl:grid-cols-4">
      <label className={etiqueta}>Local<select name="local" className={campo} defaultValue={valores.local}><option value="">Todos los locales</option>{[...new Set([...locales, ...(valores.local ? [valores.local] : [])])].map((local) => <option key={local} value={local}>{local}</option>)}</select></label>
      <label className={etiqueta}>Desde<input name="desde" type="date" className={campo} defaultValue={valores.desde} aria-invalid={Boolean(problema)} /></label>
      <label className={etiqueta}>Hasta<input name="hasta" type="date" className={campo} defaultValue={valores.hasta} aria-invalid={Boolean(problema)} /></label>
      {historial ? <label className={etiqueta}>Estado de compra<select name="estado" className={campo} defaultValue={valores.estado ?? ""}><option value="">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="APROBADA">Aprobadas</option><option value="RECHAZADA">Rechazadas</option><option value="DEVUELTA">Devueltas</option></select></label>
        : <label className={etiqueta}>Participaciones<select name="participaciones" className={campo} defaultValue={valores.participaciones ?? ""}><option value="">Todos los participantes</option><option value="con">Con participaciones</option><option value="sin">Sin participaciones</option></select></label>}
    </div>
    {problema && <p role="alert" className="mt-2 text-body-sm text-error">{problema}</p>}
    <div className="mt-space-sm flex flex-wrap items-center gap-space-sm"><button type="submit" className={boton}>Aplicar filtros</button><button type="button" className="min-h-11 rounded px-2 text-body-sm text-primary hover:underline" onClick={(event) => { event.currentTarget.form?.reset(); setError(null); limpiar(); }}>Limpiar filtros</button><span className="text-label-sm text-on-surface-variant">Fecha de compra. Incluye el día inicial y el final.</span></div>
    {activos.some((f) => f.valor) && <div className="mt-space-sm flex flex-wrap gap-2" aria-label="Filtros activos">{activos.filter((f) => f.valor).map((f) => <button key={f.clave} type="button" aria-label={`Quitar filtro ${f.texto}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-container px-3 text-label-sm text-on-surface" onClick={() => aplicar({ ...valores, [f.clave]: "" })}>{f.texto}: {f.valor}<Icono nombre="close" /></button>)}</div>}
  </form>;
}
