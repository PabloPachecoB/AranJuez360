import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { bs, fecha } from "../../../admin/format";
import { cargarComprobanteDemo } from "../datos/proveedor";
import type { CompraFidelizacion, ResultadoComprobante } from "../datos/tipos";
import { boton, Encabezado, EstadoCompra, Icono, Mensaje, panel } from "../components/elementosPresentacion";
import { textoEstadoCompra } from "../datos/etiquetasCompra";

type EstadoCarga = { estado: "cargando" | "error" } | ResultadoComprobante;
type EstadoImagen = "pendiente" | "procesando" | "completado" | "fallido";

function crearImagenComprobante(compra: CompraFidelizacion, participante: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1160;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo generar la imagen.");

  contexto.fillStyle = "#f2f4f7";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(44, 42, 812, 1076);
  contexto.strokeStyle = "#c4cbd3";
  contexto.lineWidth = 2;
  contexto.strokeRect(44, 42, 812, 1076);

  contexto.fillStyle = "#00324b";
  contexto.font = "700 38px sans-serif";
  contexto.fillText("COMPROBANTE DEMO", 88, 116);
  contexto.fillStyle = "#59636d";
  contexto.font = "24px sans-serif";
  contexto.fillText("Comprobante de ejemplo", 88, 160);
  contexto.fillStyle = "#181c20";
  contexto.font = "600 30px sans-serif";
  contexto.fillText(compra.localNombre, 88, 244);
  contexto.font = "24px sans-serif";
  contexto.fillText(`N.º ${compra.numeroComprobante}`, 88, 304);
  contexto.fillText(`Fecha: ${fecha(compra.fecha)}`, 88, 350);
  contexto.fillText(`Participante: ${participante}`, 88, 396);

  contexto.strokeStyle = "#c4cbd3";
  contexto.setLineDash([8, 8]);
  contexto.beginPath();
  contexto.moveTo(88, 454);
  contexto.lineTo(812, 454);
  contexto.stroke();
  contexto.setLineDash([]);

  contexto.fillStyle = "#59636d";
  contexto.font = "24px sans-serif";
  contexto.fillText("Total del comprobante", 88, 528);
  contexto.fillStyle = "#00324b";
  contexto.font = "700 50px sans-serif";
  contexto.fillText(bs(compra.montoBs), 88, 596);
  contexto.fillStyle = "#59636d";
  contexto.font = "24px sans-serif";
  contexto.fillText(`Estado de compra: ${textoEstadoCompra(compra.estado)}`, 88, 670);
  contexto.fillText(`Campaña: ${compra.campaniaId}`, 88, 716);

  contexto.fillStyle = "#e9eef2";
  contexto.fillRect(88, 844, 724, 160);
  contexto.fillStyle = "#59636d";
  contexto.font = "22px sans-serif";
  contexto.fillText("Vista de demostración; no es un comprobante real.", 112, 900);
  contexto.fillText("Datos de ejemplo del programa de fidelización.", 112, 946);

  return canvas.toDataURL("image/png");
}

function etiquetaOcr(estado: string) {
  switch (estado) {
    case "PENDIENTE": return "Pendiente";
    case "PROCESANDO": return "En proceso";
    case "COMPLETADO": return "Completado";
    case "FALLIDO": return "Error de lectura";
    default: return estado;
  }
}

export default function ComprobantePage() {
  const { id, compraId } = useParams<{ id: string; compraId: string }>();
  const [searchParams] = useSearchParams();
  const [resultado, setResultado] = useState<{ clave: string; estado: EstadoCarga } | null>(null);
  const [imagen, setImagen] = useState<{ compraId: string; estado: EstadoImagen; src: string | null } | null>(null);
  const [zoomGuardado, setZoomGuardado] = useState<{ compraId: string; valor: number } | null>(null);
  const clave = id && compraId ? `${id}/${compraId}` : "";

  useEffect(() => {
    let activo = true;
    if (!id || !compraId) return () => { activo = false; };
    cargarComprobanteDemo(id, compraId)
      .then((estado) => activo && setResultado({ clave: `${id}/${compraId}`, estado }))
      .catch(() => activo && setResultado({ clave: `${id}/${compraId}`, estado: { estado: "error" } }));
    return () => { activo = false; };
  }, [id, compraId]);

  const estado = useMemo<EstadoCarga>(() => !clave ? { estado: "no_encontrado" }
    : resultado?.clave === clave ? resultado.estado : { estado: "cargando" }, [clave, resultado]);
  const compra = estado.estado === "disponible" ? estado.compra : null;
  const imagenActual = compra && imagen?.compraId === compra.id
    ? imagen : { compraId: compra?.id ?? "", estado: "pendiente" as const, src: null };
  const zoom = compra && zoomGuardado?.compraId === compra.id ? zoomGuardado.valor : 1;

  useEffect(() => {
    if (estado.estado !== "disponible") return;
    const { compra, participante } = estado;
    let activo = true;
    const frame = window.requestAnimationFrame(() => {
      if (!activo) return;
      if (compra.imagenEstado === "fallida") {
        setImagen({ compraId: compra.id, estado: "fallido", src: null });
        return;
      }
      try {
        const src = crearImagenComprobante(compra, participante.nombre);
        setImagen({ compraId: compra.id, estado: "completado", src });
      } catch {
        setImagen({ compraId: compra.id, estado: "fallido", src: null });
      }
    });
    return () => { activo = false; window.cancelAnimationFrame(frame); };
  }, [estado]);

  const urlHistorial = id ? `/fidelizacion/participantes/${encodeURIComponent(id)}${searchParams.size ? `?${searchParams}` : ""}` : "/fidelizacion";
  function cambiarZoom(delta: number) {
    if (compra) setZoomGuardado({ compraId: compra.id, valor: Math.min(2.5, Math.max(0.5, zoom + delta)) });
  }

  return <>
    <Encabezado titulo={estado.estado === "disponible" ? `Comprobante ${estado.compra.numeroComprobante}` : "Comprobante de compra"} descripcion={estado.estado === "disponible" ? `${estado.participante.nombre} · ${estado.compra.localNombre}` : "Imagen y detalle de la compra seleccionada."} regreso={{ to: urlHistorial, texto: "Volver al historial" }} />
    {estado.estado === "cargando" && <Mensaje titulo="Cargando comprobante…" />}
    {estado.estado === "error" && <Mensaje error titulo="No se pudo cargar el comprobante">Recarga la página para volver a intentarlo.</Mensaje>}
    {estado.estado === "no_disponible" && <Mensaje titulo="Consulta no disponible">No se puede consultar el comprobante en este momento.</Mensaje>}
    {estado.estado === "no_encontrado" && <Mensaje titulo="Comprobante no encontrado">No se encontró el comprobante para este participante.</Mensaje>}
    {estado.estado === "disponible" && <div className="grid min-w-0 grid-cols-1 items-start gap-space-md xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
      <section aria-labelledby="imagen-comprobante-titulo" className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/40 px-space-md py-space-sm">
          <h2 id="imagen-comprobante-titulo" className="font-headline-sm text-headline-sm text-on-surface">Comprobante</h2>
          <div role="group" aria-label="Controles de zoom" className="flex items-center gap-1">
            <button className={boton} type="button" aria-label="Alejar imagen" title="Alejar" disabled={imagenActual.estado !== "completado" || zoom <= 0.5} onClick={() => cambiarZoom(-0.25)}><Icono nombre="remove" /></button>
            <button className={boton} type="button" aria-label="Restablecer zoom" title="Restablecer tamaño" disabled={imagenActual.estado !== "completado"} onClick={() => compra && setZoomGuardado({ compraId: compra.id, valor: 1 })}>{Math.round(zoom * 100)}%</button>
            <button className={boton} type="button" aria-label="Acercar imagen" title="Acercar" disabled={imagenActual.estado !== "completado" || zoom >= 2.5} onClick={() => cambiarZoom(0.25)}><Icono nombre="add" /></button>
          </div>
        </div>
        <div className="max-h-[75vh] min-h-72 overflow-auto rounded-b-xl bg-surface-container-low p-space-md" tabIndex={0} role="region" aria-label="Imagen ampliable del comprobante">
          {(imagenActual.estado === "pendiente" || imagenActual.estado === "procesando") && <div className="py-space-xl text-center text-body-sm text-on-surface-variant" role="status">Preparando imagen…</div>}
          {imagenActual.estado === "fallido" && <Mensaje error titulo="No se pudo cargar la imagen">Los datos de la compra y la lectura disponible se muestran en esta página.</Mensaje>}
          {imagenActual.estado === "completado" && imagenActual.src && <img src={imagenActual.src} alt={`Comprobante ${estado.compra.numeroComprobante} de ${estado.compra.localNombre}`} onError={() => setImagen({ compraId: estado.compra.id, estado: "fallido", src: null })} className="mx-auto h-auto max-w-none rounded shadow-sm" style={{ width: `${640 * zoom}px` }} />}
        </div>
      </section>
      <div className="min-w-0 space-y-space-md">
        <section className={panel} aria-labelledby="datos-compra-titulo">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 p-space-md"><h2 id="datos-compra-titulo" className="font-headline-sm text-headline-sm text-on-surface">Datos de la compra</h2><EstadoCompra estado={estado.compra.estado} /></div>
          <dl className="divide-y divide-outline-variant/30 px-space-md">
            {[
              ["Participante", estado.participante.nombre], ["Campaña", estado.campania.nombre],
              ["Local", estado.compra.localNombre], ["Comprobante", estado.compra.numeroComprobante],
              ["Fecha", fecha(estado.compra.fecha)], ["Monto", bs(estado.compra.montoBs)],
              ["Operador", estado.compra.operador ?? "—"],
              ["Fecha de aprobación", estado.compra.fechaAprobacion ? fecha(estado.compra.fechaAprobacion, true) : "Sin aprobación"],
            ].map(([etiqueta, valor]) => <div key={etiqueta} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3 py-3 text-body-sm"><dt className="text-on-surface-variant">{etiqueta}</dt><dd className={`wrap-break-words text-right text-on-surface ${etiqueta === "Monto" ? "font-semibold" : ""}`}>{valor}</dd></div>)}
          </dl>
        </section>
        <section aria-labelledby="lectura-ocr-titulo" className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 p-space-md">
            <h2 id="lectura-ocr-titulo" className="font-headline-sm text-headline-sm text-on-surface">Lectura del comprobante</h2>
            <span className={`rounded-full px-2.5 py-1 font-label-sm text-label-sm ${estado.compra.ocrEstado === "FALLIDO" ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface-variant"}`}>{etiquetaOcr(estado.compra.ocrEstado)}</span>
          </div>
          <div className="p-space-md">
            <p className="mb-space-sm text-label-sm text-on-surface-variant">Texto extraído (OCR). Revisa cualquier diferencia con la imagen del comprobante.</p>
            {estado.compra.ocrTexto ? <pre className="max-h-96 overflow-auto whitespace-pre-wrap wrap-break-words rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm leading-relaxed text-on-surface">{estado.compra.ocrTexto}</pre> : <div className="rounded-lg bg-surface-container-low p-space-md text-body-sm text-on-surface-variant" role={estado.compra.ocrEstado === "FALLIDO" ? "alert" : "status"}>
              {estado.compra.ocrEstado === "PENDIENTE" && "Lectura pendiente."}
              {estado.compra.ocrEstado === "PROCESANDO" && "Lectura en proceso."}
              {estado.compra.ocrEstado === "FALLIDO" && "No se pudo extraer el texto del comprobante."}
              {estado.compra.ocrEstado === "COMPLETADO" && "Lectura completada sin texto detectado."}
            </div>}
          </div>
        </section>
      </div>
    </div>}
  </>;
}
