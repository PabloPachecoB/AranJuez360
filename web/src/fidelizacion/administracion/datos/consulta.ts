import type {
  CampaniaFidelizacion,
  CompraFidelizacion,
  OrdenParticipantes,
  ParticipanteFidelizacion,
  ResultadoComprobante,
  ResultadoFichaParticipante,
} from "./tipos";

export const TAMANO_PAGINA = 10;
export const TAMANO_HISTORIAL = 5;

export function actualizarParametroConsulta(parametros: URLSearchParams, clave: string, valor: string) {
  const siguientes = new URLSearchParams(parametros);
  if (valor) siguientes.set(clave, valor);
  else siguientes.delete(clave);
  siguientes.delete("pagina");
  return siguientes;
}

export function parametrosDeRegresoLista(parametros: URLSearchParams) {
  const siguientes = new URLSearchParams(parametros);
  for (const clave of ["historialPagina", "historialLocal", "historialDesde", "historialHasta", "historialEstado"]) siguientes.delete(clave);
  return siguientes;
}

export interface FiltrosActividad {
  local: string;
  desde: string;
  hasta: string;
  participaciones?: string;
  estado?: string;
}

function fechaValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function validarPeriodo(desde: string, hasta: string): string | null {
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) return "Introduce fechas válidas para el periodo.";
  if (desde && hasta && desde > hasta) return "La fecha inicial no puede ser posterior a la fecha final.";
  return null;
}

export function filtrarCompras(compras: readonly CompraFidelizacion[], filtros: FiltrosActividad) {
  if (validarPeriodo(filtros.desde, filtros.hasta)) return [];
  return compras.filter((compra) => (!filtros.local || compra.localNombre === filtros.local)
    && (!filtros.desde || compra.fecha >= filtros.desde)
    && (!filtros.hasta || compra.fecha <= filtros.hasta)
    && (!filtros.estado || compra.estado === filtros.estado));
}

export function filtrarParticipantesPorActividad(
  participantes: readonly ParticipanteFidelizacion[],
  compras: readonly CompraFidelizacion[],
  filtros: FiltrosActividad,
) {
  const actividad = Boolean(filtros.local || filtros.desde || filtros.hasta);
  const coinciden = new Map<string, Set<string>>();
  if (actividad) {
    // Local y fechas deben coincidir en la misma compra y campaña del participante.
    for (const compra of filtrarCompras(compras, filtros)) {
      if (!coinciden.has(compra.participanteId)) coinciden.set(compra.participanteId, new Set());
      coinciden.get(compra.participanteId)!.add(compra.campaniaId);
    }
  }
  return participantes.filter((p) => (!actividad || coinciden.get(p.id)?.has(p.campaniaId))
    && (filtros.participaciones !== "con" || p.participaciones > 0)
    && (filtros.participaciones !== "sin" || p.participaciones === 0));
}

export function actualizarPaginaHistorial(parametros: URLSearchParams, pagina: number) {
  const siguientes = new URLSearchParams(parametros);
  if (pagina <= 1) siguientes.delete("historialPagina");
  else siguientes.set("historialPagina", String(pagina));
  return siguientes;
}

function normalizarTexto(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-BO").replace(/\s+/g, " ").trim();
}

export function filtrarYOrdenarParticipantes(
  participantes: readonly ParticipanteFidelizacion[],
  busqueda: string,
  campaniaId: string,
  orden: OrdenParticipantes,
) {
  const termino = normalizarTexto(busqueda);
  const palabras = termino.split(" ").filter(Boolean);
  return participantes
    .filter((participante) => {
      if (campaniaId && participante.campaniaId !== campaniaId) return false;
      if (!termino) return true;
      const texto = normalizarTexto([participante.nombre, participante.correo, participante.celular, participante.codigo].join(" "));
      if (palabras.every((palabra) => texto.includes(palabra))) return true;
      const compacto = termino.replace(/[^a-z0-9]/g, "");
      return compacto.length > 0 && [participante.celular, participante.codigo].some((campo) =>
        normalizarTexto(campo).replace(/[^a-z0-9]/g, "").includes(compacto),
      );
    })
    .sort((a, b) => {
      const diferencia = orden === "puntos" ? b.puntos - a.puntos : b.montoAprobadoBs - a.montoAprobadoBs;
      return diferencia || a.id.localeCompare(b.id, "es-BO");
    });
}

export function normalizarPagina(valor: string | null, totalPaginas: number) {
  const parseada = valor !== null && /^\d+$/.test(valor) ? Number(valor) : NaN;
  const paginaSolicitada = Number.isSafeInteger(parseada) && parseada > 0 ? parseada : 1;
  const maximo = Math.max(1, totalPaginas);
  return {
    pagina: Math.min(paginaSolicitada, maximo),
    necesitaNormalizar: valor !== null && (!Number.isSafeInteger(parseada) || parseada < 1 || parseada > maximo),
  };
}

export function normalizarParametrosConsulta(
  parametros: URLSearchParams,
  idsCampania: ReadonlySet<string>,
  totalPaginas: number,
) {
  const siguientes = new URLSearchParams(parametros);
  const campania = siguientes.get("campania");
  const orden = siguientes.get("orden");
  const pagina = siguientes.get("pagina");

  if (campania !== null && (!campania || !idsCampania.has(campania))) siguientes.delete("campania");
  if (orden !== null && orden !== "puntos" && orden !== "monto") siguientes.delete("orden");

  if (pagina !== null) {
    const estadoPagina = normalizarPagina(pagina, totalPaginas);
    if (estadoPagina.necesitaNormalizar) {
      if (estadoPagina.pagina === 1) siguientes.delete("pagina");
      else siguientes.set("pagina", String(estadoPagina.pagina));
    }
  }

  return siguientes;
}

export function encontrarFichaDemo(
  id: string,
  participantes: readonly ParticipanteFidelizacion[],
  campanias: readonly CampaniaFidelizacion[],
  compras: readonly CompraFidelizacion[],
): ResultadoFichaParticipante {
  const participante = participantes.find((fila) => fila.id === id);
  if (!participante) return { estado: "no_encontrado" };

  const campania = campanias.find((fila) => fila.id === participante.campaniaId);
  if (!campania) return { estado: "no_encontrado" };

  return {
    estado: "disponible",
    origen: "demo",
    participante,
    campania,
    compras: compras.filter((compra) => (
      compra.participanteId === participante.id && compra.campaniaId === participante.campaniaId
    )),
  };
}

export function encontrarComprobanteDemo(
  participanteId: string,
  compraId: string,
  participantes: readonly ParticipanteFidelizacion[],
  campanias: readonly CampaniaFidelizacion[],
  compras: readonly CompraFidelizacion[],
): ResultadoComprobante {
  const participante = participantes.find((fila) => fila.id === participanteId);
  if (!participante) return { estado: "no_encontrado" };

  const campania = campanias.find((fila) => fila.id === participante.campaniaId);
  if (!campania) return { estado: "no_encontrado" };

  const compra = compras.find((fila) => (
    fila.id === compraId && fila.participanteId === participante.id && fila.campaniaId === participante.campaniaId
  ));
  if (!compra) return { estado: "no_encontrado" };

  return { estado: "disponible", origen: "demo", participante, campania, compra };
}
